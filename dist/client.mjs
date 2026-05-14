import { useAuthQuery } from "better-auth/client";
import { atom } from "nanostores";
//#region src/client.ts
/**
* Client-side waitlist plugin for Better Auth.
*
* Provides typed helper methods (`join`, `status`, `verifyInvite`) and
* reactive atoms for waitlist stats that automatically refresh when
* admin actions (approve/reject) are performed.
*
* @param _options - Optional client configuration.
* @returns A `BetterAuthClientPlugin` instance to pass to `createAuthClient({ plugins: [...] })`.
*
* @example
* ```typescript
* import { createAuthClient } from "better-auth/client";
* import { waitlistClient } from "@guilhermejansen/better-auth-waitlist/client";
*
* const auth = createAuthClient({
*   plugins: [waitlistClient()],
* });
*
* // Join the waitlist
* await auth.waitlist.join({ email: "user@example.com" });
*
* // Check status
* const { data } = await auth.waitlist.status({ email: "user@example.com" });
* ```
*/
const waitlistClient = (_options) => {
	const $waitlistSignal = atom(false);
	return {
		id: "waitlist",
		$InferServerPlugin: {},
		getActions: ($fetch) => ({
			waitlist: {
				join: async (data, fetchOptions) => {
					return $fetch("/waitlist/join", {
						method: "POST",
						body: data,
						...fetchOptions
					});
				},
				status: async (data, fetchOptions) => {
					return $fetch("/waitlist/status", {
						method: "GET",
						query: data,
						...fetchOptions
					});
				},
				verifyInvite: async (data, fetchOptions) => {
					return $fetch("/waitlist/verify-invite", {
						method: "POST",
						body: data,
						...fetchOptions
					});
				}
			},
			$Infer: {}
		}),
		getAtoms($fetch) {
			return {
				$waitlistSignal,
				waitlistStats: useAuthQuery($waitlistSignal, "/waitlist/stats", $fetch, { method: "GET" })
			};
		},
		pathMethods: {
			"/waitlist/join": "POST",
			"/waitlist/status": "GET",
			"/waitlist/verify-invite": "POST",
			"/waitlist/approve": "POST",
			"/waitlist/reject": "POST",
			"/waitlist/bulk-approve": "POST",
			"/waitlist/list": "GET",
			"/waitlist/stats": "GET"
		},
		atomListeners: [{
			matcher(path) {
				return path === "/waitlist/approve" || path === "/waitlist/reject" || path === "/waitlist/bulk-approve";
			},
			signal: "$waitlistSignal"
		}, {
			matcher: (path) => path === "/waitlist/join",
			signal: "$waitlistSignal"
		}]
	};
};
//#endregion
export { waitlistClient };

//# sourceMappingURL=client.mjs.map