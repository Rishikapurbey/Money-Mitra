import { describe, expect, it } from "vitest";
import {
  buildHistory,
  detectDateOrder,
  findDuplicates,
  findHeaderRow,
  guessCategory,
  guessMapping,
  guessUnsignedMeans,
  parseAmount,
  parseCsv,
  parseDay,
  readRows,
} from "./csvImport";
import type { DraftRow } from "./csvImport";

describe("parseCsv", () => {
  it("handles quotes, commas and line breaks inside fields, and Windows line endings", () => {
    const text = '\uFEFFDate,Note,Amount\r\n05/03/2026,"Dinner, with ""friends""",250\r\n06/03/2026,"Two\nlines",10\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Note", "Amount"],
      ["05/03/2026", 'Dinner, with "friends"', "250"],
      ["06/03/2026", "Two\nlines", "10"],
    ]);
  });

  it("detects semicolons and tabs, and drops empty lines", () => {
    expect(parseCsv("Date;Amount\n\n01.02.2026;1.234,5\n")).toEqual([["Date", "Amount"], ["01.02.2026", "1.234,5"]]);
    expect(parseCsv("Date\tNarration\tAmount\n01/02/2026\tUPI, Swiggy\t100")).toEqual([
      ["Date", "Narration", "Amount"],
      ["01/02/2026", "UPI, Swiggy", "100"],
    ]);
  });

  it("removes the quote our own export puts before text like =SUM", () => {
    expect(parseCsv("Note\n'=SUM(A1)\n'-refund\nit's fine")).toEqual([["Note"], ["=SUM(A1)"], ["-refund"], ["it's fine"]]);
  });
});

describe("findHeaderRow and guessMapping", () => {
  it("skips account details above an SBI-style table and finds debit and credit columns", () => {
    const grid = parseCsv(
      [
        "Account Name,:,A KUMAR",
        "Account Number,:,0000123",
        "Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance",
        "5 Mar 2026,5 Mar 2026,UPI/402918/SWIGGY,,250.00,,9750.00",
      ].join("\n")
    );
    const header = findHeaderRow(grid);
    expect(header).toBe(2);
    expect(guessMapping(grid[header])).toMatchObject({ date: 0, description: 2, amountMode: "split", debit: 4, credit: 5 });
  });

  it("understands HDFC and ICICI headings", () => {
    expect(
      guessMapping(["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"])
    ).toMatchObject({ date: 0, description: 1, debit: 4, credit: 5, amountMode: "split" });
    expect(
      guessMapping(["S No.", "Value Date", "Transaction Date", "Cheque Number", "Transaction Remarks", "Withdrawal Amount (INR )", "Deposit Amount (INR )", "Balance (INR )"])
    ).toMatchObject({ date: 2, description: 4, debit: 5, credit: 6 });
  });

  it("maps a single amount column with a Dr/Cr column", () => {
    expect(guessMapping(["Tran Date", "Particulars", "Amount(INR)", "DR|CR", "Balance(INR)"])).toMatchObject({
      date: 0,
      description: 1,
      amountMode: "single",
      amount: 2,
      type: 3,
    });
  });

  it("recognises Money Mitra's own export", () => {
    expect(guessMapping(["Date", "Type", "Category", "Amount", "Note"])).toEqual({
      date: 0,
      description: 4,
      amountMode: "single",
      amount: 3,
      debit: -1,
      credit: -1,
      type: 1,
      category: 2,
    });
  });
});

describe("parseAmount", () => {
  it("reads rupee symbols, Indian grouping, signs and Dr/Cr", () => {
    expect(parseAmount("₹1,23,456.00")).toEqual({ value: 123456, sign: 0, labelled: false });
    expect(parseAmount("Rs. 500")).toEqual({ value: 500, sign: 0, labelled: false });
    expect(parseAmount("-250.5")).toEqual({ value: 250.5, sign: -1, labelled: false });
    expect(parseAmount("(500)")).toEqual({ value: 500, sign: -1, labelled: false });
    expect(parseAmount("+75")).toEqual({ value: 75, sign: 0, labelled: false });
    expect(parseAmount("1,234.50 Dr")).toEqual({ value: 1234.5, sign: -1, labelled: true });
    expect(parseAmount("800.00CR")).toEqual({ value: 800, sign: 1, labelled: true });
  });

  it("returns null for blanks, zero and text", () => {
    for (const raw of ["", " ", "-", "0.00", "abc", "12abc"]) expect(parseAmount(raw)).toBeNull();
  });
});

describe("dates", () => {
  it("reads the common formats", () => {
    expect(parseDay("2026-03-05", "dmy")).toBe("2026-03-05");
    expect(parseDay("2026-03-05T12:00:00Z", "dmy")).toBe("2026-03-05");
    expect(parseDay("05/03/2026", "dmy")).toBe("2026-03-05");
    expect(parseDay("05/03/2026", "mdy")).toBe("2026-05-03");
    expect(parseDay("5-3-26", "dmy")).toBe("2026-03-05");
    expect(parseDay("05.03.2026 14:22", "dmy")).toBe("2026-03-05");
    expect(parseDay("05-Mar-2026", "dmy")).toBe("2026-03-05");
    expect(parseDay("5 March 2026", "dmy")).toBe("2026-03-05");
    expect(parseDay("05Mar26", "dmy")).toBe("2026-03-05");
    expect(parseDay("Mar 5, 2026", "dmy")).toBe("2026-03-05");
  });

  it("rejects dates that don't exist", () => {
    for (const raw of ["31/02/2026", "13/13/2026", "Total", "", "05-Foo-2026"]) expect(parseDay(raw, "dmy")).toBeNull();
  });

  it("works out day-first or month-first, and asks when it can't tell", () => {
    expect(detectDateOrder(["05/03/2026", "25/03/2026"])).toEqual({ order: "dmy", numeric: true, ambiguous: false });
    expect(detectDateOrder(["03/05/2026", "03/25/2026"])).toEqual({ order: "mdy", numeric: true, ambiguous: false });
    expect(detectDateOrder(["05/03/2026", "06/03/2026"])).toEqual({ order: "dmy", numeric: true, ambiguous: true });
    expect(detectDateOrder(["2026-03-05", "5 Mar 2026"])).toEqual({ order: "dmy", numeric: false, ambiguous: false });
  });
});

describe("readRows", () => {
  it("reads split debit/credit columns and lists rows it can't read", () => {
    const grid = parseCsv(
      [
        "Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance",
        "05/03/26,UPI-SWIGGY,250.00,,9750.00",
        "06/03/26,SALARY MARCH,,50000.00,59750.00",
        "Opening balance,,,,10000",
        "07/03/26,No amount,,,",
      ].join("\n")
    );
    const { rows, skipped } = readRows(grid, 0, guessMapping(grid[0]), { dateOrder: "dmy", unsignedMeans: "income" });
    expect(rows).toEqual([
      { line: 2, day: "2026-03-05", amount: 250, type: "expense", note: "UPI-SWIGGY", category: "" },
      { line: 3, day: "2026-03-06", amount: 50000, type: "income", note: "SALARY MARCH", category: "" },
    ]);
    expect(skipped.map((s) => [s.line, s.reason])).toEqual([
      [4, "No date we could read"],
      [5, "No amount"],
    ]);
  });

  it("uses the type column or Dr/Cr first, then reads minus signs as the opposite of plain amounts", () => {
    const grid = parseCsv("Date,Amount,Type\n2026-03-01,-100,\n2026-03-02,200,\n2026-03-03,300,DR\n2026-03-04,50 Cr,\n");
    const mapping = guessMapping(grid[0]);
    const types = (unsignedMeans: "income" | "expense") =>
      readRows(grid, 0, mapping, { dateOrder: "dmy", unsignedMeans }).rows.map((r) => r.type);
    expect(types("income")).toEqual(["expense", "income", "expense", "income"]);
    expect(types("expense")).toEqual(["income", "expense", "expense", "income"]);
  });

  it("guesses a bank statement's plain amounts are money in and a card statement's are money out", () => {
    const bank = parseCsv("Date,Amount\n2026-03-01,-100\n2026-03-02,-40\n2026-03-03,5000\n");
    expect(guessUnsignedMeans(bank, 0, 1)).toBe("income");
    const card = parseCsv("Date,Amount\n2026-03-01,350\n2026-03-02,1240.50\n2026-03-03,-899\n");
    expect(guessUnsignedMeans(card, 0, 1)).toBe("expense");
  });

  it("takes categories from our own export", () => {
    const grid = parseCsv("Date,Type,Category,Amount,Note\n2026-03-05,expense,Food,250,Swiggy\n");
    const { rows } = readRows(grid, 0, guessMapping(grid[0]), { dateOrder: "dmy", unsignedMeans: "income" });
    expect(rows[0]).toMatchObject({ type: "expense", category: "Food", amount: 250, note: "Swiggy" });
  });
});

describe("guessCategory", () => {
  const history = buildHistory([
    { note: "UPI/518822/CHAI POINT/chaipoint@ybl", category: "Snacks", type: "expense" },
    { note: "UPI/112233/CHAI POINT/chaipoint@ybl", category: "Snacks", type: "expense" },
    { note: "Swiggy order", category: "Eating out", type: "expense" },
  ]);

  it("prefers what the user chose before, ignoring reference numbers", () => {
    expect(guessCategory("UPI/999999/CHAI POINT/chaipoint@ybl", "expense", history)).toBe("Snacks");
    expect(guessCategory("Paid at Chai Point", "expense", history)).toBe("Snacks");
    expect(guessCategory("UPI/402918/SWIGGY/swiggy@icici", "expense", history)).toBe("Eating out");
  });

  it("falls back to common merchants, matched as whole words", () => {
    const empty = buildHistory([]);
    expect(guessCategory("UPI/1/ZOMATO LTD", "expense", empty)).toBe("Food");
    expect(guessCategory("POS AMAZON PAY INDIA", "expense", empty)).toBe("Shopping");
    expect(guessCategory("NEFT SALARY ACME CORP", "income", empty)).toBe("Salary");
    expect(guessCategory("Granola bar", "expense", empty)).toBeNull();
    expect(guessCategory("Salary", "expense", empty)).toBeNull();
  });
});

describe("findDuplicates", () => {
  const row = (day: string, amount: number, note = "x", type: "income" | "expense" = "expense"): DraftRow => ({
    line: 0,
    day,
    amount,
    type,
    note,
    category: "",
  });

  it("matches each saved entry to one row, and flags repeated rows within the file", () => {
    const rows = [row("2026-03-05", 250), row("2026-03-05", 250), row("2026-03-06", 99, "Tea 1"), row("2026-03-06", 99, "Tea 2"), row("2026-03-06", 99, "Coffee")];
    const existing = [{ day: "2026-03-05", type: "expense", amount: 250 }];
    expect(findDuplicates(rows, existing)).toEqual([true, false, false, true, false]);
  });
});
