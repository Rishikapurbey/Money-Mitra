-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_type_name_key" ON "Category"("userId", "type", "name");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every category each user already uses in transactions, recurring rules and budgets
INSERT INTO "Category" ("id", "name", "type", "userId")
SELECT gen_random_uuid()::text, used."name", used."type", used."userId"
FROM (
    SELECT DISTINCT "category" AS "name", "type", "userId" FROM "Transaction"
    UNION
    SELECT DISTINCT "category", "type", "userId" FROM "RecurringTransaction"
    UNION
    SELECT DISTINCT "category", 'expense', "userId" FROM "Budget"
) AS used
ON CONFLICT DO NOTHING;

-- The starter set, skipping any a user already has in some capitalisation.
-- The placeholder account for deleted users gets none.
INSERT INTO "Category" ("id", "name", "type", "userId")
SELECT gen_random_uuid()::text, starter."name", starter."type", u."id"
FROM "User" u
CROSS JOIN (VALUES
    ('Food', 'expense'), ('Rent', 'expense'), ('Transport', 'expense'), ('Shopping', 'expense'),
    ('Bills', 'expense'), ('Health', 'expense'), ('Entertainment', 'expense'),
    ('Salary', 'income'), ('Freelance', 'income')
) AS starter("name", "type")
WHERE u."username" <> 'deleted_user'
  AND NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."userId" = u."id" AND c."type" = starter."type" AND lower(c."name") = lower(starter."name")
  );
