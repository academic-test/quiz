export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function startAssessment(payload) {
  return request("/api/assessments/start", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function apiSection(section) {
  return section === "mathematics-science" ? "mathematics_science" : section;
}

export function getQuestions(sessionId, offset = 0, limit = 10, section = "") {
  const normalizedSection = apiSection(section);
  const sectionQuery = normalizedSection ? "&section=" + encodeURIComponent(normalizedSection) : "";
  return request(
    "/api/assessments/" +
      encodeURIComponent(sessionId) +
      "/questions?offset=" +
      encodeURIComponent(offset) +
      "&limit=" +
      encodeURIComponent(limit) +
      sectionQuery
  );
}

export function prepareSection(sessionId, section) {
  const normalizedSection = apiSection(section);
  return request(
    "/api/assessments/" +
      encodeURIComponent(sessionId) +
      "/prepare-section",
    {
      method: "POST",
      body: JSON.stringify({ section: normalizedSection })
    }
  );
}

export function saveResponse(payload) {
  return request("/api/responses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function saveWritingResponse(payload) {
  return request("/api/writing-responses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function finishAttempt(attemptId, payload) {
  return request("/api/attempts/" + encodeURIComponent(attemptId), {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
