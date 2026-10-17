// V-Record 0.6.0 has no published in-app update yet. The client treats 204 as current.
export function onRequestGet() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
