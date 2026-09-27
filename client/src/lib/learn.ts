export const LEVELS = ["Basics", "Intermediate", "Advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const LEARN_TOPICS = ["Budgeting", "Saving", "Investing", "Loans & Credit", "Tax"] as const;
export type LearnTopic = (typeof LEARN_TOPICS)[number];

// Shown on tax terms, since rates and limits change with each Budget
export const TAX_LAST_REVIEWED = "September 2026";

export interface Term {
  slug: string;
  term: string;
  level: Level;
  topic: LearnTopic;
  short: string;
  explanation: string[];
  example: string;
  whyItMatters: string;
  related: string[];
}

export const TERMS: Term[] = [
  // Basics
  {
    slug: "budget",
    term: "Budget",
    level: "Basics",
    topic: "Budgeting",
    short: "A plan for how you'll use the money you earn each month.",
    explanation: [
      "A budget is simply a plan: before the month starts, you decide how much goes to needs, how much to wants, and how much you save.",
      "A popular starting point is the 50/30/20 rule: 50% of your take-home pay for needs (rent, groceries, bills), 30% for wants (eating out, shopping), and 20% for savings and investments.",
    ],
    example:
      "With a take-home salary of ₹50,000, the 50/30/20 rule suggests about ₹25,000 for needs, ₹15,000 for wants and ₹10,000 for savings.",
    whyItMatters:
      "Without a plan, spending quietly expands to fill whatever you earn. A budget makes saving the default instead of whatever is left over.",
    related: ["emergency-fund", "inflation", "sip"],
  },
  {
    slug: "emergency-fund",
    term: "Emergency fund",
    level: "Basics",
    topic: "Saving",
    short: "Money set aside only for unexpected events like job loss or a medical bill.",
    explanation: [
      "An emergency fund is a cushion of cash you don't touch for anything else. A common guideline is to keep 3 to 6 months of your essential expenses.",
      "It should be easy to access quickly, so people usually keep it in a savings account, a sweep-in FD or a liquid mutual fund rather than in shares.",
    ],
    example: "If your essential monthly expenses are ₹30,000, a 6-month emergency fund would be ₹1,80,000.",
    whyItMatters:
      "It stops a surprise expense from turning into credit card debt or forcing you to sell investments at a bad time.",
    related: ["budget", "fixed-deposit", "liquidity"],
  },
  {
    slug: "inflation",
    term: "Inflation",
    level: "Basics",
    topic: "Saving",
    short: "The rise in prices over time, which makes each rupee buy a little less.",
    explanation: [
      "Inflation is the rate at which prices of everyday things go up. When inflation is 6%, something that costs ₹100 this year costs about ₹106 next year.",
      "Money sitting idle loses buying power. To actually grow your wealth, your savings need to earn more than inflation after tax.",
    ],
    example: "At 6% inflation, something that costs ₹100 today would cost about ₹179 in 10 years.",
    whyItMatters:
      "A savings account earning less than inflation is quietly shrinking your money. Inflation is why long-term goals need investing, not just saving.",
    related: ["compound-interest", "fixed-deposit", "mutual-fund"],
  },
  {
    slug: "simple-interest",
    term: "Simple interest",
    level: "Basics",
    topic: "Saving",
    short: "Interest calculated only on the original amount.",
    explanation: [
      "With simple interest, you earn the same amount every year because it's always calculated on the money you started with, never on interest already earned.",
      "Formula: interest = principal × rate × years.",
    ],
    example: "₹10,000 at 8% simple interest for 10 years earns ₹800 a year, so you end with ₹18,000.",
    whyItMatters: "It's the baseline for understanding why compound interest is so much more powerful over time.",
    related: ["compound-interest", "fixed-deposit"],
  },
  {
    slug: "compound-interest",
    term: "Compound interest",
    level: "Basics",
    topic: "Saving",
    short: "Earning interest on your interest, so money grows faster over time.",
    explanation: [
      "With compounding, each year's interest is added to your balance, and next year you earn interest on that bigger balance.",
      "The effect is small at first and very large over long periods. Time matters more than the amount you start with.",
    ],
    example:
      "₹10,000 at 8% compounded yearly grows to about ₹21,589 in 10 years, compared with ₹18,000 under simple interest.",
    whyItMatters: "Starting early, even with small amounts, gives compounding more years to work. Waiting has a real cost.",
    related: ["simple-interest", "sip", "cagr"],
  },
  {
    slug: "fixed-deposit",
    term: "Fixed deposit (FD)",
    level: "Basics",
    topic: "Saving",
    short: "A bank deposit that pays a fixed interest rate for a fixed period.",
    explanation: [
      "You deposit a lump sum with a bank for a set time, from a few days to 10 years, at an interest rate agreed on day one.",
      "FDs are low risk and predictable. Breaking one early usually means a small penalty, and the interest is taxed at your income tax slab rate.",
    ],
    example: "₹1,00,000 in an FD at 7% for 3 years, compounded quarterly, grows to about ₹1,23,144.",
    whyItMatters:
      "Good for money you'll need at a known time, like a planned purchase. Over long periods, returns after tax may barely beat inflation.",
    related: ["compound-interest", "inflation", "emergency-fund"],
  },
  {
    slug: "emi",
    term: "EMI",
    level: "Basics",
    topic: "Loans & Credit",
    short: "Equated Monthly Instalment: the fixed amount you pay each month on a loan.",
    explanation: [
      "An EMI repays a loan in equal monthly payments. Each payment covers part of the interest and part of the original loan amount.",
      "Early EMIs are mostly interest; later ones are mostly principal. A longer tenure lowers the EMI but increases the total interest you pay.",
    ],
    example:
      "A ₹5,00,000 loan at 10% a year for 5 years has an EMI of about ₹10,624. Over 60 months you pay about ₹6,37,411, so roughly ₹1,37,411 is interest.",
    whyItMatters:
      "Always look at the total interest, not just the EMI. A common guideline is to keep all EMIs below about 30 to 40% of your take-home pay.",
    related: ["credit-score", "credit-utilization", "budget"],
  },
  {
    slug: "credit-score",
    term: "Credit score (CIBIL)",
    level: "Basics",
    topic: "Loans & Credit",
    short: "A number from 300 to 900 that shows lenders how reliably you repay.",
    explanation: [
      "Credit bureaus like CIBIL track your loans and credit cards and turn your history into a score. Higher is better; around 750 or above is generally considered good.",
      "Paying on time is the biggest factor. Using a high share of your credit limit, many new loan applications and missed payments all pull it down.",
    ],
    example:
      "Two people apply for the same home loan. The one with a score of 780 is more likely to be approved, and often at a lower interest rate, than the one with 650.",
    whyItMatters:
      "A good score can save you a lot of money in interest on big loans. You can check your score for free once a year from each credit bureau.",
    related: ["credit-utilization", "emi"],
  },
  {
    slug: "liquidity",
    term: "Liquidity",
    level: "Basics",
    topic: "Saving",
    short: "How quickly you can turn something into cash without losing value.",
    explanation: [
      "Cash in a savings account is highly liquid. A house or a PPF account is not: selling or withdrawing takes time or comes with limits.",
      "Liquidity usually trades off against returns. Money you might need soon should be in liquid places.",
    ],
    example: "Your savings account is available today, while money in PPF is locked for 15 years with only limited early withdrawals.",
    whyItMatters: "Matching liquidity to when you'll need the money prevents forced selling or penalties.",
    related: ["emergency-fund", "ppf", "fixed-deposit"],
  },

  // Intermediate
  {
    slug: "mutual-fund",
    term: "Mutual fund",
    level: "Intermediate",
    topic: "Investing",
    short: "A pool of money from many investors, managed by professionals.",
    explanation: [
      "A mutual fund collects money from many people and invests it in shares, bonds or both. You own units of the fund, and their value rises or falls with the investments.",
      "Equity funds invest mainly in shares (higher risk, higher long-term potential). Debt funds invest in bonds (lower risk, steadier). Hybrid funds mix both.",
    ],
    example: "Instead of picking 50 companies yourself, you can buy units of one fund that already holds all 50.",
    whyItMatters:
      "Mutual funds give small investors diversification and professional management. Returns are not guaranteed and depend on the markets.",
    related: ["sip", "nav", "expense-ratio", "index-fund"],
  },
  {
    slug: "sip",
    term: "SIP",
    level: "Intermediate",
    topic: "Investing",
    short: "Systematic Investment Plan: investing a fixed amount in a mutual fund every month.",
    explanation: [
      "With a SIP, a fixed amount is automatically invested on a set date each month. It builds a habit and removes the pressure of timing the market.",
      "You can start with small amounts, often ₹500 a month, and stop or change the amount any time.",
    ],
    example:
      "Investing ₹5,000 a month for 10 years is ₹6,00,000 in total. If the fund returned 12% a year, it would grow to about ₹11.6 lakh. This is an illustration; real returns vary and are not guaranteed.",
    whyItMatters: "SIPs turn investing into a routine and make use of compounding and rupee cost averaging.",
    related: ["mutual-fund", "rupee-cost-averaging", "compound-interest"],
  },
  {
    slug: "nav",
    term: "NAV",
    level: "Intermediate",
    topic: "Investing",
    short: "Net Asset Value: the price of one unit of a mutual fund.",
    explanation: [
      "NAV is the value of everything the fund owns, minus expenses, divided by the number of units. It's calculated at the end of each business day.",
      "A low NAV doesn't mean a fund is cheap, and a high NAV doesn't mean it's expensive. What matters is how the value grows.",
    ],
    example: "Investing ₹10,000 when the NAV is ₹50 gives you 200 units.",
    whyItMatters: "Understanding NAV stops you from choosing funds for the wrong reason, like a low unit price.",
    related: ["mutual-fund", "sip"],
  },
  {
    slug: "expense-ratio",
    term: "Expense ratio",
    level: "Intermediate",
    topic: "Investing",
    short: "The yearly fee a mutual fund charges, as a percentage of your investment.",
    explanation: [
      "The expense ratio covers the fund's management and running costs. It's deducted from the fund's value automatically, so you never see a bill.",
      "Direct plans have lower expense ratios than regular plans, because no distributor commission is included.",
    ],
    example:
      "₹1,00,000 invested for 20 years in a fund earning 12% before fees grows to roughly ₹8.1 lakh with a 1% expense ratio, but roughly ₹9.3 lakh with a 0.2% expense ratio.",
    whyItMatters: "A small-looking fee difference compounds into a large amount over the years.",
    related: ["mutual-fund", "index-fund"],
  },
  {
    slug: "index-fund",
    term: "Index fund",
    level: "Intermediate",
    topic: "Investing",
    short: "A fund that simply copies a market index like the Nifty 50.",
    explanation: [
      "An index fund buys the same companies, in the same proportions, as an index. It doesn't try to beat the market; it aims to match it.",
      "Because no one is actively picking stocks, index funds usually have very low expense ratios.",
    ],
    example: "A Nifty 50 index fund holds the 50 companies in the Nifty 50, so its returns closely follow the Nifty 50 itself.",
    whyItMatters: "Low cost and built-in diversification make index funds a simple starting point for long-term investing.",
    related: ["mutual-fund", "expense-ratio", "diversification"],
  },
  {
    slug: "diversification",
    term: "Diversification",
    level: "Intermediate",
    topic: "Investing",
    short: "Spreading money across different investments to reduce risk.",
    explanation: [
      "Different investments rise and fall at different times. Holding a mix means one bad investment can't sink everything.",
      "You can diversify across companies, sectors and asset types like shares, bonds and gold.",
    ],
    example:
      "If all your money is in one company's shares and it falls 40%, you lose 40%. If that company is one of 50 you hold, the same fall affects a small part of your money.",
    whyItMatters: "Diversification is one of the few ways to lower risk without necessarily giving up long-term returns.",
    related: ["asset-allocation", "mutual-fund", "index-fund"],
  },
  {
    slug: "ppf",
    term: "PPF",
    level: "Intermediate",
    topic: "Saving",
    short: "Public Provident Fund: a government-backed long-term savings scheme.",
    explanation: [
      "PPF has a 15-year lock-in, with limited withdrawals allowed after a few years. You can invest up to ₹1.5 lakh a year.",
      "The interest rate is set by the government and reviewed every quarter. Contributions can qualify for a tax deduction under the old tax regime, and the interest and maturity amount are tax-free.",
    ],
    example: "Investing a fixed amount in PPF every year for 15 years builds a tax-free, government-backed corpus for a long-term goal.",
    whyItMatters: "Safe and tax-efficient for long-term goals, but the long lock-in means it's not for money you might need soon.",
    related: ["section-80c", "epf", "liquidity"],
  },
  {
    slug: "epf",
    term: "EPF",
    level: "Intermediate",
    topic: "Saving",
    short: "Employees' Provident Fund: retirement savings shared by you and your employer.",
    explanation: [
      "If you're a salaried employee covered by EPF, 12% of your basic salary goes into EPF each month, and your employer contributes as well.",
      "It earns interest declared yearly by the EPFO and is meant for retirement, though partial withdrawals are allowed for things like a home, education or medical needs.",
    ],
    example: "If your basic salary is ₹30,000 a month, your own contribution is ₹3,600 a month, before your employer's share.",
    whyItMatters: "EPF is often a large part of a salaried person's retirement savings. Avoid withdrawing it when changing jobs; transfer it instead.",
    related: ["ppf", "nps", "section-80c"],
  },
  {
    slug: "nps",
    term: "NPS",
    level: "Intermediate",
    topic: "Investing",
    short: "National Pension System: a government-regulated retirement investment account.",
    explanation: [
      "NPS invests your contributions in a mix of shares, corporate bonds and government bonds, and you can choose the mix.",
      "It's designed for retirement: most of the money stays invested until 60, and part of it must be used to buy an annuity that pays a regular pension.",
    ],
    example: "Someone who starts contributing to NPS at 25 has 35 years for their money to compound before retirement.",
    whyItMatters: "It encourages long-term retirement saving at low cost, but money is largely locked in until retirement.",
    related: ["epf", "asset-allocation", "liquidity"],
  },
  {
    slug: "elss",
    term: "ELSS",
    level: "Intermediate",
    topic: "Tax",
    short: "Equity Linked Savings Scheme: a mutual fund that can also save tax.",
    explanation: [
      "ELSS funds invest mainly in shares and have a 3-year lock-in, the shortest among the common tax-saving options under the old tax regime.",
      "Returns depend on the stock market, so they can be higher than PPF or FDs over the long run, but they aren't guaranteed.",
    ],
    example: "If you invest in an ELSS fund through a monthly SIP, each instalment is locked for 3 years from its own date.",
    whyItMatters: "It combines tax saving with long-term investing, if you're using the old tax regime.",
    related: ["section-80c", "mutual-fund", "old-vs-new-tax-regime"],
  },

  // Advanced
  {
    slug: "asset-allocation",
    term: "Asset allocation",
    level: "Advanced",
    topic: "Investing",
    short: "How you divide your money between shares, bonds, gold and cash.",
    explanation: [
      "Asset allocation is the big-picture mix of your investments. It has a larger effect on your risk and returns than picking individual funds.",
      "A simple rule of thumb is to hold roughly (100 minus your age)% in shares. It's only a starting point; your goals and comfort with risk matter more.",
    ],
    example: "By that rule, a 30-year-old might hold about 70% in equity funds and 30% in debt, adjusting as goals approach.",
    whyItMatters: "Getting the mix right keeps your risk matched to your goals, and rebalancing once a year keeps it on track.",
    related: ["diversification", "mutual-fund", "nps"],
  },
  {
    slug: "cagr",
    term: "CAGR",
    level: "Advanced",
    topic: "Investing",
    short: "Compound Annual Growth Rate: the steady yearly rate that explains growth over time.",
    explanation: [
      "CAGR answers: if my investment had grown at the same rate every year, what would that rate be? It smooths out the ups and downs.",
      "It works for a single lump-sum investment. For regular investments like SIPs, XIRR is the right measure.",
    ],
    example: "If ₹1,00,000 becomes ₹2,00,000 in 6 years, the CAGR is about 12.25% a year.",
    whyItMatters: "It lets you compare investments held for different periods on a fair basis.",
    related: ["xirr", "compound-interest"],
  },
  {
    slug: "xirr",
    term: "XIRR",
    level: "Advanced",
    topic: "Investing",
    short: "A yearly return figure for investments made at different times, like SIPs.",
    explanation: [
      "With a SIP, each instalment is invested for a different length of time, so a simple percentage gain is misleading. XIRR accounts for the date and amount of every investment.",
      "Most mutual fund apps and statements show XIRR for your holdings. You can also calculate it with the XIRR function in a spreadsheet.",
    ],
    example:
      "If a SIP statement shows your money grew 40% in total over 5 years, the XIRR will be much lower than 40% per year, because most instalments were invested for less than 5 years.",
    whyItMatters: "XIRR is the honest way to judge how your SIPs are really doing.",
    related: ["cagr", "sip"],
  },
  {
    slug: "rupee-cost-averaging",
    term: "Rupee cost averaging",
    level: "Advanced",
    topic: "Investing",
    short: "Investing a fixed amount regularly, so you buy more units when prices are low.",
    explanation: [
      "When you invest the same amount each month, you automatically buy more units when prices fall and fewer when they rise.",
      "Over time this tends to bring your average cost per unit below the simple average of the prices you bought at.",
    ],
    example:
      "Investing ₹3,000 a month at NAVs of ₹100, ₹75 and ₹120 buys 30, 40 and 25 units: 95 units for ₹9,000. Your average cost is about ₹94.74, below the average price of ₹98.33.",
    whyItMatters: "It takes the guesswork out of timing the market and makes falling markets less stressful.",
    related: ["sip", "nav"],
  },
  {
    slug: "capital-gains",
    term: "Capital gains",
    level: "Advanced",
    topic: "Tax",
    short: "The profit you make when you sell an investment for more than you paid.",
    explanation: [
      "Capital gains are taxed when you sell. Whether a gain is short-term or long-term depends on how long you held the investment, and the two are taxed at different rates.",
      "For listed shares and equity mutual funds, holding for more than 12 months makes the gain long-term, which is usually taxed at a lower rate, with a yearly exemption limit. Rates and limits change with the Budget, so check the current ones before you sell.",
    ],
    example: "If you buy fund units for ₹50,000 and sell them for ₹65,000, your capital gain is ₹15,000.",
    whyItMatters: "How long you hold an investment can noticeably change the tax you pay on it.",
    related: ["old-vs-new-tax-regime", "mutual-fund"],
  },
  {
    slug: "old-vs-new-tax-regime",
    term: "Old vs new tax regime",
    level: "Advanced",
    topic: "Tax",
    short: "Two ways to calculate income tax: more deductions, or lower rates.",
    explanation: [
      "The old regime has higher tax rates but lets you reduce taxable income with deductions such as 80C investments, health insurance and home loan interest.",
      "The new regime has lower rates and is the default, but allows very few deductions. Salaried people can usually choose each year.",
    ],
    example:
      "Someone with large deductions (a home loan, full 80C investments, health insurance) may pay less under the old regime; someone with few deductions often pays less under the new one.",
    whyItMatters: "Choosing the right regime each year can save a meaningful amount of tax. The income-tax website has a calculator to compare both.",
    related: ["section-80c", "elss", "capital-gains"],
  },
  {
    slug: "section-80c",
    term: "Section 80C",
    level: "Advanced",
    topic: "Tax",
    short: "A deduction of up to ₹1.5 lakh a year for certain investments, under the old regime.",
    explanation: [
      "Investments such as PPF, EPF, ELSS, life insurance premiums and home loan principal can reduce your taxable income by up to ₹1.5 lakh a year in total under the old regime.",
      "It isn't available under the new regime. A new Income-tax Act from April 2026 renumbers many sections, but this deduction is still widely known as 80C.",
    ],
    example: "If your EPF contribution is ₹60,000 a year, you'd need up to ₹90,000 more in other eligible investments to use the full ₹1.5 lakh.",
    whyItMatters: "Invest because it suits your goals, not just to save tax. The deduction only helps if you're using the old regime.",
    related: ["old-vs-new-tax-regime", "ppf", "elss", "epf"],
  },
  {
    slug: "credit-utilization",
    term: "Credit utilization",
    level: "Advanced",
    topic: "Loans & Credit",
    short: "How much of your credit card limit you're using.",
    explanation: [
      "Credit utilization is your card balance divided by your credit limit. Using a large share of your limit can signal financial stress and lower your credit score.",
      "A common guideline is to keep it under about 30%.",
    ],
    example: "With a ₹1,00,000 limit and a ₹25,000 bill, your utilization is 25%.",
    whyItMatters: "Keeping utilization low and paying the full bill on time are two of the easiest ways to protect your credit score.",
    related: ["credit-score", "emi"],
  },
  {
    slug: "term-vs-ulip",
    term: "Term insurance vs ULIP",
    level: "Advanced",
    topic: "Investing",
    short: "Pure life cover, versus a plan that mixes insurance and investment.",
    explanation: [
      "Term insurance pays your family a large sum if you die during the policy term, and nothing if you survive. That's why it's cheap for the cover it gives.",
      "A ULIP combines insurance and market-linked investment in one product. Because it mixes the two, costs are often higher and the life cover lower than buying each separately.",
    ],
    example:
      "A common guideline is life cover of about 10 to 15 times your annual income. For someone earning ₹8 lakh a year, that's ₹80 lakh to ₹1.2 crore of term cover.",
    whyItMatters: "Many people are better served by buying term insurance for protection and investing separately for growth.",
    related: ["mutual-fund", "asset-allocation"],
  },
];

export const termBySlug = (slug: string) => TERMS.find((t) => t.slug === slug);
