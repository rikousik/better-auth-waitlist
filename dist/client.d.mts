import { i as WaitlistEntry, r as WaitlistClientOptions, t as waitlist } from "./index-COPYdCVu.mjs";
import * as _$better_auth_client0 from "better-auth/client";
import * as _$nanostores from "nanostores";
import * as _$_better_fetch_fetch0 from "@better-fetch/fetch";

//#region src/client.d.ts
interface WaitlistStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  registered: number;
}
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
declare const waitlistClient: (_options?: WaitlistClientOptions) => {
  id: "waitlist";
  $InferServerPlugin: ReturnType<typeof waitlist>;
  getActions: ($fetch: _$_better_fetch_fetch0.BetterFetch) => {
    waitlist: {
      join: (data: {
        email: string;
        referredBy?: string;
        metadata?: Record<string, unknown>;
      }, fetchOptions?: RequestInit) => Promise<{
        data: unknown;
        error: null;
      } | {
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      }>;
      status: (data: {
        email: string;
      }, fetchOptions?: RequestInit) => Promise<{
        data: unknown;
        error: null;
      } | {
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      }>;
      verifyInvite: (data: {
        inviteCode: string;
      }, fetchOptions?: RequestInit) => Promise<{
        data: unknown;
        error: null;
      } | {
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      }>;
    };
    $Infer: {
      WaitlistEntry: WaitlistEntry;
    };
  };
  getAtoms($fetch: _$_better_fetch_fetch0.BetterFetch): {
    $waitlistSignal: _$nanostores.PreinitializedWritableAtom<boolean> & object;
    waitlistStats: _$better_auth_client0.AuthQueryAtom<WaitlistStats>;
  };
  pathMethods: {
    "/waitlist/join": "POST";
    "/waitlist/status": "GET";
    "/waitlist/verify-invite": "POST";
    "/waitlist/approve": "POST";
    "/waitlist/reject": "POST";
    "/waitlist/bulk-approve": "POST";
    "/waitlist/list": "GET";
    "/waitlist/stats": "GET";
  };
  atomListeners: ({
    matcher(path: string): path is "/waitlist/approve" | "/waitlist/reject" | "/waitlist/bulk-approve";
    signal: "$waitlistSignal";
  } | {
    matcher: (path: string) => path is "/waitlist/join";
    signal: "$waitlistSignal";
  })[];
};
//#endregion
export { type WaitlistClientOptions, type WaitlistEntry, waitlistClient };
//# sourceMappingURL=client.d.mts.map