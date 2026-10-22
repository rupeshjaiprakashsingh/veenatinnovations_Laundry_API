CREATE TABLE IF NOT EXISTS "customer_feedback" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "rating" INTEGER,
    "message" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_feedback_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5)),
    CONSTRAINT "customer_feedback_rating_or_message_check" CHECK ("rating" IS NOT NULL OR NULLIF(BTRIM("message"), '') IS NOT NULL),
    CONSTRAINT "customer_feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customer_feedback_customerId_createdDate_idx"
    ON "customer_feedback"("customerId", "createdDate");