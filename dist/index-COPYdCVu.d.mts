import * as _$_better_auth_core_utils_error_codes0 from "@better-auth/core/utils/error-codes";
import * as _$better_auth0 from "better-auth";

//#region src/types.d.ts
type WaitlistStatus = "pending" | "approved" | "rejected" | "registered";
interface WaitlistEntry {
  id: string;
  email: string;
  status: WaitlistStatus;
  inviteCode: string | null;
  inviteExpiresAt: Date | null;
  position: number | null;
  referredBy: string | null;
  metadata: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  registeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
interface WaitlistOptions {
  /** Whether the waitlist gate is active. Defaults to true. */
  enabled?: boolean;
  /** Require an invite code to register instead of just being approved. */
  requireInviteCode?: boolean;
  /** Invite code TTL in seconds. Defaults to 172800 (48 hours). */
  inviteCodeExpiration?: number;
  /** Maximum number of entries allowed on the waitlist. */
  maxWaitlistSize?: number;
  /** Skip waitlist checks for anonymous sign-ins. Defaults to false. */
  skipAnonymous?: boolean;
  /**
   * Automatically approve entries when they join.
   * Pass `true` to auto-approve all, or a function for conditional logic.
   */
  autoApprove?: boolean | ((email: string) => boolean | Promise<boolean>);
  /**
   * List of Better Auth paths to intercept. Defaults to all registration paths.
   */
  interceptPaths?: string[];
  /**
   * Roles that are allowed to perform admin actions.
   * Defaults to ["admin"].
   */
  adminRoles?: string[];
  /** Called after an entry joins the waitlist. */
  onJoinWaitlist?: (entry: WaitlistEntry) => void | Promise<void>;
  /** Called after an entry is approved. */
  onApproved?: (entry: WaitlistEntry) => void | Promise<void>;
  /** Called after an entry is rejected. */
  onRejected?: (entry: WaitlistEntry) => void | Promise<void>;
  /**
   * Called when an entry is approved to send the invite email.
   * You must implement this to deliver invite codes to users.
   */
  sendInviteEmail?: (data: {
    email: string;
    inviteCode: string;
    expiresAt: Date;
  }) => void | Promise<void>;
  /** Customise table and field names for the waitlist schema. */
  schema?: {
    waitlist?: {
      modelName?: string;
      fields?: Record<string, string>;
    };
  };
}
interface WaitlistClientOptions {
  /** Base URL override for waitlist API calls. */
  baseURL?: string;
}
//#endregion
//#region src/error-codes.d.ts
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
declare const WAITLIST_ERROR_CODES: {
  EMAIL_ALREADY_IN_WAITLIST: _$_better_auth_core_utils_error_codes0.RawError<"EMAIL_ALREADY_IN_WAITLIST">;
  WAITLIST_ENTRY_NOT_FOUND: _$_better_auth_core_utils_error_codes0.RawError<"WAITLIST_ENTRY_NOT_FOUND">;
  NOT_APPROVED: _$_better_auth_core_utils_error_codes0.RawError<"NOT_APPROVED">;
  INVALID_INVITE_CODE: _$_better_auth_core_utils_error_codes0.RawError<"INVALID_INVITE_CODE">;
  INVITE_CODE_REQUIRED: _$_better_auth_core_utils_error_codes0.RawError<"INVITE_CODE_REQUIRED">;
  ALREADY_REGISTERED: _$_better_auth_core_utils_error_codes0.RawError<"ALREADY_REGISTERED">;
  WAITLIST_FULL: _$_better_auth_core_utils_error_codes0.RawError<"WAITLIST_FULL">;
  UNAUTHORIZED_ADMIN_ACTION: _$_better_auth_core_utils_error_codes0.RawError<"UNAUTHORIZED_ADMIN_ACTION">;
};
//#endregion
//#region src/index.d.ts
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
declare const waitlist: (options?: WaitlistOptions) => {
  id: "waitlist";
  init(): {
    options: {
      databaseHooks: {
        user: {
          create: {
            before(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, ctx: _$better_auth0.GenericEndpointContext | null): Promise<false | undefined>;
            after(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, ctx: _$better_auth0.GenericEndpointContext | null): Promise<void>;
          };
        };
      };
    };
  };
  endpoints: {
    joinWaitlist: StrictEndpoint<Path, Options, R>;
    getWaitlistStatus: StrictEndpoint<Path, Options, R>;
    verifyInviteCode: StrictEndpoint<Path, Options, R>;
    approveEntry: StrictEndpoint<Path, Options, R>;
    rejectEntry: StrictEndpoint<Path, Options, R>;
    bulkApprove: StrictEndpoint<Path, Options, R>;
    listWaitlist: StrictEndpoint<Path, Options, R>;
    getWaitlistStats: StrictEndpoint<Path, Options, R>;
  };
  hooks: {
    before: {
      matcher(context: {
        path?: string;
      }): boolean;
      handler: (inputContext: better_call0.MiddlewareInputContext<Options_1>) => Promise<void>;
    }[];
  };
  schema: {
    waitlist: {
      fields: {
        email: {
          type: "string";
          required: true;
          unique: true;
        };
        status: {
          type: "string";
          required: true;
          defaultValue: string;
        };
        inviteCode: {
          type: "string";
          required: false;
          unique: true;
        };
        inviteExpiresAt: {
          type: "date";
          required: false;
        };
        position: {
          type: "number";
          required: false;
        };
        referredBy: {
          type: "string";
          required: false;
        };
        metadata: {
          type: "string";
          required: false;
        };
        approvedAt: {
          type: "date";
          required: false;
        };
        rejectedAt: {
          type: "date";
          required: false;
        };
        registeredAt: {
          type: "date";
          required: false;
        };
        createdAt: {
          type: "date";
          required: true;
        };
        updatedAt: {
          type: "date";
          required: true;
        };
      };
    };
  };
  $ERROR_CODES: {
    EMAIL_ALREADY_IN_WAITLIST: _$_better_auth_core_utils_error_codes0.RawError<"EMAIL_ALREADY_IN_WAITLIST">;
    WAITLIST_ENTRY_NOT_FOUND: _$_better_auth_core_utils_error_codes0.RawError<"WAITLIST_ENTRY_NOT_FOUND">;
    NOT_APPROVED: _$_better_auth_core_utils_error_codes0.RawError<"NOT_APPROVED">;
    INVALID_INVITE_CODE: _$_better_auth_core_utils_error_codes0.RawError<"INVALID_INVITE_CODE">;
    INVITE_CODE_REQUIRED: _$_better_auth_core_utils_error_codes0.RawError<"INVITE_CODE_REQUIRED">;
    ALREADY_REGISTERED: _$_better_auth_core_utils_error_codes0.RawError<"ALREADY_REGISTERED">;
    WAITLIST_FULL: _$_better_auth_core_utils_error_codes0.RawError<"WAITLIST_FULL">;
    UNAUTHORIZED_ADMIN_ACTION: _$_better_auth_core_utils_error_codes0.RawError<"UNAUTHORIZED_ADMIN_ACTION">;
  };
};
//#endregion
export { WaitlistOptions as a, WaitlistEntry as i, WAITLIST_ERROR_CODES as n, WaitlistStatus as o, WaitlistClientOptions as r, waitlist as t };
//# sourceMappingURL=index-COPYdCVu.d.mts.map