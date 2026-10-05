export async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
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

export function getQuestions(sessionId) {
  return request(
    "/api/questions?year=9&session_id=" + encodeURIComponent(sessionId)
  );
}

export function createAttempt(payload) {
  return request("/api/attempts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function saveResponse(payload) {
  return request("/api/responses", {
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
