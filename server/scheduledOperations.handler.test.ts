import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const invokeLLM = vi.fn();
const authenticateRequest = vi.fn();

vi.mock("./db", () => ({ getDb }));
vi.mock("./_core/llm", () => ({ invokeLLM }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));

const { runCampusFixScheduledOperation } = await import("./scheduledOperations");

function queryResult<T>(value: T) {
  return {
    limit: vi.fn(async () => value),
    then: <TResult1 = T, TResult2 = never>(resolve: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined) => Promise.resolve(value).then(resolve, reject),
  };
}

function createDb(operationKey: "daily-analytics-summary" | "system-health-check") {
  const queryValues = [
    [{ id: "schedule-1", operationKey }],
    [{ id: "open-1", category: "wifi" }],
    [{ id: "active-1", category: "account" }],
    [{ id: "resolved-1", category: "printing" }],
    [{ id: "agent-run-1" }],
    [{ id: "schedule-1", operationKey }],
    [{ id: "open-1", category: "wifi" }],
    [{ id: "active-1", category: "account" }],
    [{ id: "resolved-1", category: "printing" }],
    [{ id: "agent-run-1" }],
  ];
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => queryResult(queryValues.shift() ?? [])), limit: vi.fn(() => queryResult(queryValues.shift() ?? [])) })) })),
    update: vi.fn(() => ({ set: updateSet })),
    insert: vi.fn(),
    updateSet,
    updateWhere,
  };
}

function cronResponse() {
  const response = { json: vi.fn(), status: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe("CampusFix scheduled handler repeat safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "Repeat-safe derived operational detail." } }] });
  });

  it.each(["daily-analytics-summary", "system-health-check"] as const)("re-running %s refreshes only the schedule status record", async operationKey => {
    const db = createDb(operationKey);
    getDb.mockResolvedValue(db);
    const request = { originalUrl: "/api/campusfix/cron" } as never;

    await runCampusFixScheduledOperation(request, cronResponse() as never);
    await runCampusFixScheduledOperation(request, cronResponse() as never);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(db.updateSet).toHaveBeenCalledWith(expect.objectContaining({ lastStatus: "success", details: "Repeat-safe derived operational detail." }));
  });
});
