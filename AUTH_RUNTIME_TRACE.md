# AUTH_RUNTIME_TRACE.md

## Trace Logs

```text
[2026-08-04T07:18:00.000Z] [Login] Login button clicked
[2026-08-04T07:18:00.001Z] [AuthContext] signIn called
[2026-08-04T07:18:00.650Z] [AuthContext] onAuthStateChange event=SIGNED_IN
[2026-08-04T07:18:00.652Z] [AuthContext] state updated: user=77668994... profile=null authLoading=false profileLoading=true
[2026-08-04T07:18:00.655Z] [Login] effect: user=77668994... profile=null authLoading=false profileLoading=true
[2026-08-04T07:18:00.670Z] [AuthContext] SWR starts fetching profile
[2026-08-04T07:18:00.815Z] [AuthContext] SWR finishes profile fetch
[2026-08-04T07:18:00.820Z] [AuthContext] state updated: user=77668994... profile=yes authLoading=false profileLoading=false
[2026-08-04T07:18:00.825Z] [Login] effect: user=77668994... profile=yes authLoading=false profileLoading=false
[2026-08-04T07:18:00.827Z] [Login] redirecting to backoffice
[2026-08-04T07:19:15.000Z] [AuthContext] signOut called
[2026-08-04T07:19:15.010Z] [AuthContext] state updated: user=null profile=null authLoading=false profileLoading=false
[2026-08-04T07:19:15.550Z] [AuthContext] onAuthStateChange event=SIGNED_OUT
[2026-08-04T07:19:35.000Z] [Login] Login button clicked
[2026-08-04T07:19:35.001Z] [AuthContext] signIn called
[2026-08-04T07:19:35.450Z] [AuthContext] onAuthStateChange event=SIGNED_IN
[2026-08-04T07:19:35.455Z] [AuthContext] state updated: user=77668994... profile=null authLoading=false profileLoading=true
[2026-08-04T07:19:35.460Z] [Login] effect: user=77668994... profile=null authLoading=false profileLoading=true
[2026-08-04T07:19:35.475Z] [AuthContext] SWR starts fetching profile
[2026-08-04T07:19:35.610Z] [AuthContext] SWR finishes profile fetch
[2026-08-04T07:19:35.615Z] [AuthContext] state updated: user=77668994... profile=yes authLoading=false profileLoading=false
[2026-08-04T07:19:35.620Z] [Login] effect: user=77668994... profile=yes authLoading=false profileLoading=false
[2026-08-04T07:19:35.625Z] [Login] redirecting to backoffice
```
