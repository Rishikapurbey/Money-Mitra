import { formatINR } from "../lib/ui";
import type { AccountPeriod } from "../lib/accounts";

// Money in and out of each account over a recap's month or a year, and where each one ended up
function AccountsSummary({ accounts, endLabel }: { accounts: AccountPeriod[]; endLabel: string }) {
  if (accounts.length === 0) return null;
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-semibold text-ink-900">Your accounts</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-500">
            <tr>
              <th scope="col" className="text-left font-medium pb-2">Account</th>
              <th scope="col" className="text-right font-medium pb-2 pl-3">In</th>
              <th scope="col" className="text-right font-medium pb-2 pl-3">Out</th>
              <th scope="col" className="text-right font-medium pb-2 pl-3">{endLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {accounts.map((a) => {
              const card = a.kind === "liability";
              return (
                <tr key={a.id}>
                  <td className="py-2.5 pr-2 text-ink-900 font-medium">
                    {a.name}
                    {card && <span className="block text-xs font-normal text-ink-500">Credit card</span>}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-gain">{a.moneyIn > 0 ? formatINR(a.moneyIn) : "–"}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums text-ink-700">{a.moneyOut > 0 ? formatINR(a.moneyOut) : "–"}</td>
                  <td className={`py-2.5 pl-3 text-right tabular-nums font-semibold ${!card && a.balance < 0 ? "text-loss" : "text-ink-900"}`}>
                    {formatINR(a.balance)}
                    {card && <span className="block text-xs font-normal text-ink-500">owed</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">In and out include transfers between your own accounts.</p>
    </section>
  );
}

export default AccountsSummary;
