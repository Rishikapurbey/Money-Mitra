// Answers shown on the landing page and, with the app-specific ones, in Settings > Help
export const faqs = [
  {
    q: "Is Money Mitra free?",
    a: "Yes. Tracking, budgets, goals, Learn and Discuss are all free to use.",
  },
  {
    q: "Do I need to connect my bank account?",
    a: "No. You add transactions yourself, and we never ask for your bank login or card details.",
  },
  {
    q: "Is my data safe?",
    a: "Your transactions, budgets and goals are private to your account. Passwords are stored securely hashed, never in plain text. We don't show ads and we don't sell your data.",
  },
  {
    q: "Can other people see who I am in Discuss?",
    a: "Only if you choose to show your username. When you post or reply anonymously, other users never see your name. Your identity is kept privately so we can moderate abuse.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Money Mitra is for education and personal tracking. For decisions about your own situation, especially tax or investments, consider a qualified adviser.",
  },
];

// Only useful once someone is using the app
export const appFaqs = [
  {
    q: "How do accounts work?",
    a: "Add your bank accounts, cash and credit cards in Tracker > Net worth, and type in what each holds today. From then on, every income or expense you add says which account it was paid from or received in, and that account's balance moves by itself. The one marked Default is filled in for you; you can pick another each time.",
  },
  {
    q: "What's a transfer, and why doesn't it count as spending?",
    a: "A transfer moves your own money between two of your accounts: taking cash out of an ATM, moving savings into your salary account, or paying a credit card bill. You haven't spent or earned anything, so budgets and totals ignore it; only the two balances change. Choose the Transfer tab when adding a transaction.",
  },
  {
    q: "What happens if I spend more than an account holds?",
    a: "Its balance goes below zero and turns red, and we'll suggest moving money in from another account, for example from your savings. If your bank shows a different balance, use Update value on the Net worth page to set the real one; your entries from then on are counted from that.",
  },
  {
    q: "How are credit cards counted?",
    a: "A credit card is something you owe. Spending on it adds to what you owe and refunds lower it, so your net worth goes down when you spend, not when you pay the bill. Paying the bill is a transfer from your bank to the card. Add the card's limit to see how much of it you've used, with a warning at 80%.",
  },
  {
    q: "How do recurring transactions work?",
    a: "Tick \"Repeat every month\" when you add a transaction, such as rent or salary. Each month's entry is added automatically the next time you open Money Mitra, even if you were away for a while. You can pause or stop it from the Recurring card in the Tracker.",
  },
  {
    q: "Can I rename or combine categories?",
    a: "Yes, in Settings > Categories. Renaming or merging also updates your past transactions, budgets and recurring entries, so your history stays consistent.",
  },
  {
    q: "How do I find an old transaction?",
    a: "Use the search box and filters above the transactions list in the Tracker. Change the date range to \"All time\" to search everything, and the total for what matches is shown above the list.",
  },
  {
    q: "Can I use Money Mitra like an app on my phone?",
    a: "Yes. Open the menu under your name and choose \"Install app\", or use your browser's \"Add to Home screen\" option. It then opens full screen like any other app.",
  },
  {
    q: "I forgot my password. What do I do?",
    a: "Choose \"Forgot password?\" on the login page and we'll email you a link to set a new one. The link works once and expires after 30 minutes.",
  },
];
