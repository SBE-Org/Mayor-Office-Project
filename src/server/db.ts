import { PrismaClient } from "@prisma/client";

// Records that form the official, traceable history. They may be created but
// never silently modified or deleted (business rule 9).
const APPEND_ONLY = new Set(["ExecutiveDecision", "CaseAction", "AuditLog", "DepartmentResponse", "CorrespondenceAction"]);
const MUTATING = new Set(["update", "updateMany", "upsert", "delete", "deleteMany"]);

function createClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && APPEND_ONLY.has(model) && MUTATING.has(operation)) {
            throw new Error(`${model} records are append-only and cannot be modified or deleted.`);
          }
          return query(args);
        },
      },
    },
  });
}

type Client = ReturnType<typeof createClient>;
const g = globalThis as unknown as { __prisma?: Client };
export const prisma: Client = g.__prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export type Db = Client;
export type Tx = Parameters<Extract<Parameters<Client["$transaction"]>[0], (...a: never[]) => unknown>>[0];
