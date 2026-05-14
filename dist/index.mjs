import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "@better-auth/core/error";
import { mergeSchema } from "better-auth/db";
import { defineErrorCodes } from "@better-auth/core/utils/error-codes";
import { sessionMiddleware } from "better-auth/api";
import * as z from "zod";
//#region src/error-codes.ts
/**
* Error codes returned by the waitlist plugin endpoints.
*
* Use these constants to match errors programmatically.
* Each error code is a `RawError` object with `{ code, message }` shape.
*
* @example
* ```typescript
* import { WAITLIST_ERROR_CODES } from "@guilhermejansen/better-auth-waitlist";
*
* if (error.code === WAITLIST_ERROR_CODES.NOT_APPROVED.code) {
*   // redirect to waitlist page
* }
* ```
*/
const WAITLIST_ERROR_CODES = defineErrorCodes({
	EMAIL_ALREADY_IN_WAITLIST: "This email is already on the waitlist",
	WAITLIST_ENTRY_NOT_FOUND: "Waitlist entry not found",
	NOT_APPROVED: "You must be approved from the waitlist to register",
	INVALID_INVITE_CODE: "Invalid or expired invite code",
	INVITE_CODE_REQUIRED: "An invite code is required to register",
	ALREADY_REGISTERED: "This waitlist entry has already been used for registration",
	WAITLIST_FULL: "The waitlist is currently full",
	UNAUTHORIZED_ADMIN_ACTION: "You are not authorized to perform this action"
});
//#endregion
//#region src/routes/admin.ts
const adminMiddleware = (options) => createAuthMiddleware({ use: [sessionMiddleware] }, async (ctx) => {
	const adminRoles = options.adminRoles ?? ["admin"];
	const userRole = ctx.context.session.user.role;
	if (!userRole || !adminRoles.includes(userRole)) throw APIError.from("FORBIDDEN", WAITLIST_ERROR_CODES.UNAUTHORIZED_ADMIN_ACTION);
	return { session: ctx.context.session };
});
const approveEntry = (options) => createAuthEndpoint("/waitlist/approve", {
	method: "POST",
	body: z.object({ email: z.email() }),
	use: [adminMiddleware(options)],
	metadata: { openapi: {
		description: "Approve a waitlist entry",
		responses: { 200: { description: "Entry approved" } }
	} }
}, async (ctx) => {
	const normalizedEmail = ctx.body.email.toLowerCase();
	const entry = await ctx.context.adapter.findOne({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}]
	});
	if (!entry) throw APIError.from("NOT_FOUND", WAITLIST_ERROR_CODES.WAITLIST_ENTRY_NOT_FOUND);
	if (entry.status === "registered") throw APIError.from("BAD_REQUEST", WAITLIST_ERROR_CODES.ALREADY_REGISTERED);
	const inviteCode = crypto.randomUUID();
	const expSeconds = options.inviteCodeExpiration ?? 172800;
	const inviteExpiresAt = new Date(Date.now() + expSeconds * 1e3);
	const now = /* @__PURE__ */ new Date();
	const updated = await ctx.context.adapter.update({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}],
		update: {
			status: "approved",
			inviteCode,
			inviteExpiresAt,
			approvedAt: now,
			updatedAt: now
		}
	});
	const updatedEntry = {
		...entry,
		...updated
	};
	if (options.sendInviteEmail) await options.sendInviteEmail({
		email: normalizedEmail,
		inviteCode,
		expiresAt: inviteExpiresAt
	});
	if (options.onApproved) await options.onApproved(updatedEntry);
	return ctx.json(updatedEntry);
});
const rejectEntry = (options) => createAuthEndpoint("/waitlist/reject", {
	method: "POST",
	body: z.object({
		email: z.email(),
		reason: z.string().optional()
	}),
	use: [adminMiddleware(options)],
	metadata: { openapi: {
		description: "Reject a waitlist entry",
		responses: { 200: { description: "Entry rejected" } }
	} }
}, async (ctx) => {
	const normalizedEmail = ctx.body.email.toLowerCase();
	const entry = await ctx.context.adapter.findOne({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}]
	});
	if (!entry) throw APIError.from("NOT_FOUND", WAITLIST_ERROR_CODES.WAITLIST_ENTRY_NOT_FOUND);
	const now = /* @__PURE__ */ new Date();
	const updated = await ctx.context.adapter.update({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}],
		update: {
			status: "rejected",
			rejectedAt: now,
			updatedAt: now
		}
	});
	const updatedEntry = {
		...entry,
		...updated
	};
	if (options.onRejected) await options.onRejected(updatedEntry);
	return ctx.json(updatedEntry);
});
const bulkApprove = (options) => createAuthEndpoint("/waitlist/bulk-approve", {
	method: "POST",
	body: z.object({
		emails: z.array(z.email()).optional(),
		count: z.number().int().positive().optional()
	}),
	use: [adminMiddleware(options)],
	metadata: { openapi: {
		description: "Bulk approve waitlist entries",
		responses: { 200: { description: "Entries approved" } }
	} }
}, async (ctx) => {
	const { emails, count } = ctx.body;
	const approved = [];
	const inviteExpSeconds = options.inviteCodeExpiration ?? 172800;
	if (emails && emails.length > 0) for (const email of emails) {
		const normalizedEmail = email.toLowerCase();
		const entry = await ctx.context.adapter.findOne({
			model: "waitlist",
			where: [{
				field: "email",
				value: normalizedEmail
			}]
		});
		if (!entry || entry.status !== "pending") continue;
		const inviteCode = crypto.randomUUID();
		const inviteExpiresAt = new Date(Date.now() + inviteExpSeconds * 1e3);
		const now = /* @__PURE__ */ new Date();
		await ctx.context.adapter.update({
			model: "waitlist",
			where: [{
				field: "email",
				value: normalizedEmail
			}],
			update: {
				status: "approved",
				inviteCode,
				inviteExpiresAt,
				approvedAt: now,
				updatedAt: now
			}
		});
		const updatedEntry = {
			...entry,
			status: "approved",
			inviteCode,
			inviteExpiresAt,
			approvedAt: now,
			updatedAt: now
		};
		approved.push(updatedEntry);
		if (options.sendInviteEmail) await options.sendInviteEmail({
			email: normalizedEmail,
			inviteCode,
			expiresAt: inviteExpiresAt
		});
		if (options.onApproved) await options.onApproved(updatedEntry);
	}
	else if (count) {
		const pending = await ctx.context.adapter.findMany({
			model: "waitlist",
			where: [{
				field: "status",
				value: "pending"
			}],
			sortBy: {
				field: "position",
				direction: "asc"
			},
			limit: count
		});
		for (const entry of pending) {
			const inviteCode = crypto.randomUUID();
			const inviteExpiresAt = new Date(Date.now() + inviteExpSeconds * 1e3);
			const now = /* @__PURE__ */ new Date();
			await ctx.context.adapter.update({
				model: "waitlist",
				where: [{
					field: "id",
					value: entry.id
				}],
				update: {
					status: "approved",
					inviteCode,
					inviteExpiresAt,
					approvedAt: now,
					updatedAt: now
				}
			});
			const updatedEntry = {
				...entry,
				status: "approved",
				inviteCode,
				inviteExpiresAt,
				approvedAt: now,
				updatedAt: now
			};
			approved.push(updatedEntry);
			if (options.sendInviteEmail) await options.sendInviteEmail({
				email: entry.email,
				inviteCode,
				expiresAt: inviteExpiresAt
			});
			if (options.onApproved) await options.onApproved(updatedEntry);
		}
	}
	return ctx.json({
		approved: approved.length,
		entries: approved
	});
});
const listWaitlist = (options) => createAuthEndpoint("/waitlist/list", {
	method: "GET",
	query: z.object({
		status: z.enum([
			"pending",
			"approved",
			"rejected",
			"registered"
		]).optional(),
		page: z.coerce.number().int().positive().optional(),
		limit: z.coerce.number().int().positive().max(100).optional(),
		sortBy: z.enum([
			"createdAt",
			"position",
			"email",
			"status"
		]).optional(),
		sortDirection: z.enum(["asc", "desc"]).optional()
	}),
	use: [adminMiddleware(options)],
	metadata: { openapi: {
		description: "List waitlist entries with pagination",
		responses: { 200: { description: "Paginated waitlist entries" } }
	} }
}, async (ctx) => {
	const page = ctx.query.page ?? 1;
	const limit = ctx.query.limit ?? 20;
	const offset = (page - 1) * limit;
	const where = ctx.query.status ? [{
		field: "status",
		value: ctx.query.status
	}] : void 0;
	const entries = await ctx.context.adapter.findMany({
		model: "waitlist",
		where,
		sortBy: {
			field: ctx.query.sortBy ?? "createdAt",
			direction: ctx.query.sortDirection ?? "desc"
		},
		limit,
		offset
	});
	const total = await ctx.context.adapter.count({
		model: "waitlist",
		where
	});
	return ctx.json({
		entries,
		total,
		page,
		totalPages: Math.ceil(total / limit)
	});
});
const getWaitlistStats = (options) => createAuthEndpoint("/waitlist/stats", {
	method: "GET",
	use: [adminMiddleware(options)],
	metadata: { openapi: {
		description: "Get waitlist statistics",
		responses: { 200: { description: "Waitlist statistics" } }
	} }
}, async (ctx) => {
	const total = await ctx.context.adapter.count({ model: "waitlist" });
	const pending = await ctx.context.adapter.count({
		model: "waitlist",
		where: [{
			field: "status",
			value: "pending"
		}]
	});
	const approved = await ctx.context.adapter.count({
		model: "waitlist",
		where: [{
			field: "status",
			value: "approved"
		}]
	});
	const rejected = await ctx.context.adapter.count({
		model: "waitlist",
		where: [{
			field: "status",
			value: "rejected"
		}]
	});
	const registered = await ctx.context.adapter.count({
		model: "waitlist",
		where: [{
			field: "status",
			value: "registered"
		}]
	});
	return ctx.json({
		total,
		pending,
		approved,
		rejected,
		registered
	});
});
//#endregion
//#region src/routes/public.ts
const joinWaitlist = (options) => createAuthEndpoint("/waitlist/join", {
	method: "POST",
	body: z.object({
		email: z.email(),
		referredBy: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional()
	}),
	metadata: { openapi: {
		description: "Join the waitlist",
		responses: { 200: { description: "Successfully joined the waitlist" } }
	} }
}, async (ctx) => {
	const { email, referredBy, metadata } = ctx.body;
	const normalizedEmail = email.toLowerCase();
	if (await ctx.context.adapter.findOne({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}]
	})) throw APIError.from("BAD_REQUEST", WAITLIST_ERROR_CODES.EMAIL_ALREADY_IN_WAITLIST);
	if (options.maxWaitlistSize) {
		if (await ctx.context.adapter.count({ model: "waitlist" }) >= options.maxWaitlistSize) throw APIError.from("BAD_REQUEST", WAITLIST_ERROR_CODES.WAITLIST_FULL);
	}
	const totalCount = await ctx.context.adapter.count({ model: "waitlist" });
	let status = "pending";
	let inviteCode = null;
	let inviteExpiresAt = null;
	let approvedAt = null;
	if (options.autoApprove) {
		if (typeof options.autoApprove === "function" ? await options.autoApprove(normalizedEmail) : true) {
			status = "approved";
			inviteCode = crypto.randomUUID();
			const expSeconds = options.inviteCodeExpiration ?? 172800;
			inviteExpiresAt = new Date(Date.now() + expSeconds * 1e3);
			approvedAt = /* @__PURE__ */ new Date();
		}
	}
	const now = /* @__PURE__ */ new Date();
	const entry = await ctx.context.adapter.create({
		model: "waitlist",
		data: {
			email: normalizedEmail,
			status,
			inviteCode,
			inviteExpiresAt,
			position: totalCount + 1,
			referredBy: referredBy ?? null,
			metadata: metadata ? JSON.stringify(metadata) : null,
			approvedAt,
			rejectedAt: null,
			registeredAt: null,
			createdAt: now,
			updatedAt: now
		}
	});
	if (options.onJoinWaitlist) await options.onJoinWaitlist(entry);
	if (status === "approved" && options.sendInviteEmail && inviteCode && inviteExpiresAt) await options.sendInviteEmail({
		email: normalizedEmail,
		inviteCode,
		expiresAt: inviteExpiresAt
	});
	if (status === "approved" && options.onApproved) await options.onApproved(entry);
	return ctx.json({
		id: entry.id,
		email: entry.email,
		status: entry.status,
		position: entry.position,
		createdAt: entry.createdAt
	});
});
const getWaitlistStatus = (_options) => createAuthEndpoint("/waitlist/status", {
	method: "GET",
	query: z.object({ email: z.email() }),
	metadata: { openapi: {
		description: "Check waitlist status for an email",
		responses: { 200: { description: "Waitlist status" } }
	} }
}, async (ctx) => {
	const normalizedEmail = ctx.query.email.toLowerCase();
	const entry = await ctx.context.adapter.findOne({
		model: "waitlist",
		where: [{
			field: "email",
			value: normalizedEmail
		}]
	});
	if (!entry) throw APIError.from("NOT_FOUND", WAITLIST_ERROR_CODES.WAITLIST_ENTRY_NOT_FOUND);
	return ctx.json({
		status: entry.status,
		position: entry.position
	});
});
const verifyInviteCode = (_options) => createAuthEndpoint("/waitlist/verify-invite", {
	method: "POST",
	body: z.object({ inviteCode: z.string() }),
	metadata: { openapi: {
		description: "Verify a waitlist invite code",
		responses: { 200: { description: "Invite code verification result" } }
	} }
}, async (ctx) => {
	const { inviteCode } = ctx.body;
	const entry = await ctx.context.adapter.findOne({
		model: "waitlist",
		where: [{
			field: "inviteCode",
			value: inviteCode
		}, {
			field: "status",
			value: "approved"
		}]
	});
	if (!entry) return ctx.json({
		valid: false,
		email: null
	});
	if (entry.inviteExpiresAt && new Date(entry.inviteExpiresAt) < /* @__PURE__ */ new Date()) return ctx.json({
		valid: false,
		email: null
	});
	return ctx.json({
		valid: true,
		email: entry.email
	});
});
//#endregion
//#region src/schema.ts
const schema = { waitlist: { fields: {
	email: {
		type: "string",
		required: true,
		unique: true
	},
	status: {
		type: "string",
		required: true,
		defaultValue: "pending"
	},
	inviteCode: {
		type: "string",
		required: false,
		unique: true
	},
	inviteExpiresAt: {
		type: "date",
		required: false
	},
	position: {
		type: "number",
		required: false
	},
	referredBy: {
		type: "string",
		required: false
	},
	metadata: {
		type: "string",
		required: false
	},
	approvedAt: {
		type: "date",
		required: false
	},
	rejectedAt: {
		type: "date",
		required: false
	},
	registeredAt: {
		type: "date",
		required: false
	},
	createdAt: {
		type: "date",
		required: true
	},
	updatedAt: {
		type: "date",
		required: true
	}
} } };
//#endregion
//#region src/index.ts
const DEFAULT_INTERCEPT_PATHS = [
	"/sign-up/email",
	"/callback/",
	"/oauth2/callback/",
	"/magic-link/verify",
	"/sign-in/email-otp",
	"/email-otp/verify-email",
	"/phone-number/verify",
	"/sign-in/anonymous",
	"/one-tap/callback",
	"/siwe/verify"
];
/**
* Waitlist plugin for Better Auth.
*
* Gates all registration paths behind an invite-based waitlist system.
* New sign-ups are intercepted at the request level and via database hooks,
* ensuring no unapproved user can be created regardless of the auth method
* (email/password, OAuth, magic-link, OTP, etc.).
*
* @param options - Configuration options for the waitlist plugin.
* @returns A `BetterAuthPlugin` instance to pass to `betterAuth({ plugins: [...] })`.
*
* @example
* ```typescript
* import { betterAuth } from "better-auth";
* import { waitlist } from "@guilhermejansen/better-auth-waitlist";
*
* export const auth = betterAuth({
*   plugins: [
*     waitlist({
*       requireInviteCode: true,
*       sendInviteEmail: async ({ email, inviteCode }) => {
*         await sendEmail({ to: email, subject: "You're in!", body: inviteCode });
*       },
*     }),
*   ],
* });
* ```
*/
const waitlist = (options) => {
	const opts = {
		enabled: true,
		requireInviteCode: false,
		inviteCodeExpiration: 172800,
		skipAnonymous: false,
		adminRoles: ["admin"],
		...options
	};
	return {
		id: "waitlist",
		init() {
			return { options: { databaseHooks: { user: { create: {
				async before(user, ctx) {
					if (opts.enabled === false) return;
					if (opts.skipAnonymous && user.isAnonymous) return;
					if (!user.email) return;
					const email = user.email.toLowerCase();
					if (!ctx) return;
					const adapter = ctx.context?.adapter;
					if (!adapter) return;
					if (!await adapter.findOne({
						model: "waitlist",
						where: [{
							field: "email",
							value: email
						}, {
							field: "status",
							value: "approved"
						}]
					})) return false;
				},
				async after(user, ctx) {
					if (opts.enabled === false) return;
					if (!user.email) return;
					if (!ctx) return;
					const email = user.email.toLowerCase();
					const adapter = ctx.context?.adapter;
					if (!adapter) return;
					if (await adapter.findOne({
						model: "waitlist",
						where: [{
							field: "email",
							value: email
						}]
					})) await adapter.update({
						model: "waitlist",
						where: [{
							field: "email",
							value: email
						}],
						update: {
							status: "registered",
							registeredAt: /* @__PURE__ */ new Date(),
							updatedAt: /* @__PURE__ */ new Date()
						}
					});
				}
			} } } } };
		},
		endpoints: {
			joinWaitlist: joinWaitlist(opts),
			getWaitlistStatus: getWaitlistStatus(opts),
			verifyInviteCode: verifyInviteCode(opts),
			approveEntry: approveEntry(opts),
			rejectEntry: rejectEntry(opts),
			bulkApprove: bulkApprove(opts),
			listWaitlist: listWaitlist(opts),
			getWaitlistStats: getWaitlistStats(opts)
		},
		hooks: { before: [{
			matcher(context) {
				if (opts.enabled === false) return false;
				return (opts.interceptPaths ?? DEFAULT_INTERCEPT_PATHS).some((p) => context.path === p || context.path?.startsWith(p));
			},
			handler: createAuthMiddleware(async (ctx) => {
				const email = ctx.body?.email;
				if (email) {
					const normalizedEmail = email.toLowerCase();
					if (await ctx.context.internalAdapter.findUserByEmail(normalizedEmail)) return;
				}
				if (opts.requireInviteCode) {
					const code = ctx.body?.inviteCode || ctx.headers?.get("x-invite-code");
					if (!code) throw APIError.from("FORBIDDEN", WAITLIST_ERROR_CODES.INVITE_CODE_REQUIRED);
					const entry = await ctx.context.adapter.findOne({
						model: "waitlist",
						where: [{
							field: "inviteCode",
							value: code
						}, {
							field: "status",
							value: "approved"
						}]
					});
					if (!entry) throw APIError.from("FORBIDDEN", WAITLIST_ERROR_CODES.INVALID_INVITE_CODE);
					if (entry.inviteExpiresAt && new Date(entry.inviteExpiresAt) < /* @__PURE__ */ new Date()) throw APIError.from("FORBIDDEN", WAITLIST_ERROR_CODES.INVALID_INVITE_CODE);
				} else if (email) {
					const normalizedEmail = email.toLowerCase();
					const entry = await ctx.context.adapter.findOne({
						model: "waitlist",
						where: [{
							field: "email",
							value: normalizedEmail
						}]
					});
					if (!entry || entry.status !== "approved") throw APIError.from("FORBIDDEN", WAITLIST_ERROR_CODES.NOT_APPROVED);
				}
			})
		}] },
		schema: mergeSchema(schema, opts.schema),
		$ERROR_CODES: WAITLIST_ERROR_CODES
	};
};
//#endregion
export { WAITLIST_ERROR_CODES, waitlist };

//# sourceMappingURL=index.mjs.map