export default function MarketingHome() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <h1 className="text-2xl font-medium mb-3">StayEngine</h1>
      <p className="text-gray-600 mb-8">
        Give every hotel its own branded booking engine. Subscribe, connect your
        property, and start taking direct bookings on your own subdomain, custom
        domain, or embedded on your existing site.
      </p>
      <a
        href="/admin/login"
        className="inline-block border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
      >
        Hotel admin login
      </a>
      <p className="text-sm text-gray-500 mt-10">
        Demo property:{" "}
        <a className="underline" href="http://riverside-inn.localhost:3000">
          riverside-inn.localhost:3000
        </a>{" "}
        (run locally with subdomains mapped in /etc/hosts, or use the /sites/riverside-inn
        preview route)
      </p>
      <a
        href="/sites/riverside-inn"
        className="inline-block mt-2 text-sm underline text-gray-600"
      >
        Preview the demo booking site directly →
      </a>
    </main>
  );
}
