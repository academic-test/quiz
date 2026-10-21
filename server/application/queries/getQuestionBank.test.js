const { describe, it, expect, vi } = require("vitest");
const { getQuestionBank } = require("./getQuestionBank");

function createSupabaseMock({ data = [], error = null } = {}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject)
  };
  return {
    from: vi.fn(() => query),
    query
  };
}

describe("getQuestionBank query handler", () => {
  it("returns the existing question-bank response shape and counts assigned rows", async () => {
    const supabase = createSupabaseMock({
      data: [
        { id: "q1", session_id: null },
        { id: "q2", session_id: "active-session" }
      ]
    });

    const result = await getQuestionBank({ supabase, section: "humanities" });

    expect(result).toEqual({
      section: "humanities",
      questions: [
        { id: "q1", session_id: null },
        { id: "q2", session_id: "active-session" }
      ],
      count: 2,
      active_count: 1
    });
    expect(supabase.from).toHaveBeenCalledWith("generated_questions");
    expect(supabase.query.order).toHaveBeenNthCalledWith(1, "stimulus_group", { ascending: true });
    expect(supabase.query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("returns the database error for the route adapter to handle", async () => {
    const error = { message: "database unavailable" };
    const supabase = createSupabaseMock({ error });

    await expect(getQuestionBank({ supabase, section: "humanities" }))
      .resolves.toEqual({ error });
  });

  it("normalizes a null data result to an empty question list", async () => {
    const supabase = createSupabaseMock({ data: null });

    await expect(getQuestionBank({ supabase, section: "mathematics_science" }))
      .resolves.toEqual({
        section: "mathematics_science",
        questions: [],
        count: 0,
        active_count: 0
      });
  });
});
