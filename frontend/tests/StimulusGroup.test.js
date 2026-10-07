import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StimulusGroup from "../src/components/StimulusGroup.vue";

const questions = [
  { id: "q1", q: "Which conclusion is best supported?", o: ["A", "B", "C", "D"] },
  { id: "q2", q: "Which statement is most reasonable?", o: ["A", "B", "C", "D"] },
  { id: "q3", q: "What is the main implication?", o: ["A", "B", "C", "D"] },
  { id: "q4", q: "Which factor matters most?", o: ["A", "B", "C", "D"] },
  { id: "q5", q: "Which claim is supported?", o: ["A", "B", "C", "D"] },
  { id: "q6", q: "What can be inferred?", o: ["A", "B", "C", "D"] }
];

const baseProps = {
  questions,
  stimulusNumber: 1,
  questionStart: 1,
  questionEnd: 6,
  totalQuestions: 40,
  answers: {},
  answeredCount: 0,
  unansweredCount: 6
};

describe("StimulusGroup", () => {
  it("renders every question in a grouped stimulus page", () => {
    const wrapper = mount(StimulusGroup, { props: baseProps });

    expect(wrapper.findAll(".stimulus-question")).toHaveLength(6);
    expect(wrapper.text()).toContain("Question 1");
    expect(wrapper.text()).toContain("Question 6");

    const review = wrapper.find("button.review-submit-btn");
    expect(review.text()).toContain("Save Answer & Review");
    expect(review.attributes("disabled")).toBeDefined();
  });

  it("shows feedback for every question after review and changes Review into Next Page", async () => {
    const results = Object.fromEntries(
      questions.map((question, index) => [
        question.id,
        {
          correct: index % 2 === 0,
          feedback: { correctAnswer: 1, explanation: "Explanation for " + question.id }
        }
      ])
    );

    const wrapper = mount(StimulusGroup, {
      props: {
        ...baseProps,
        answeredCount: 6,
        unansweredCount: 0,
        pageComplete: true,
        pageReviewed: true,
        results
      }
    });

    expect(wrapper.findAll(".stimulus-feedback")).toHaveLength(6);
    expect(wrapper.findAll(".stimulus-feedback-explanation")).toHaveLength(6);
    expect(wrapper.text()).toContain("Explanation for q1");
    expect(wrapper.text()).toContain("Explanation for q6");
    expect(wrapper.find("button.review-submit-btn").text()).toContain("Next Page");

    await wrapper.find("button.review-submit-btn").trigger("click");
    expect(wrapper.emitted("next")).toHaveLength(1);
  });


  it("does not show Next Page just because results exist; review state controls the transition", () => {
    const results = Object.fromEntries(
      questions.map(question => [
        question.id,
        { correct: true, feedback: { correctAnswer: 0, explanation: "Reviewed explanation" } }
      ])
    );

    const wrapper = mount(StimulusGroup, {
      props: {
        ...baseProps,
        answeredCount: 6,
        unansweredCount: 0,
        results,
        pageReviewed: false
      }
    });

    expect(wrapper.find("button.review-submit-btn").text()).toContain("Save Answer & Review");
  });

  it("emits submit when Save Answer & Review is clicked", async () => {
    const wrapper = mount(StimulusGroup, {
      props: { ...baseProps, answeredCount: 6, unansweredCount: 0 }
    });

    await wrapper.find("button.review-submit-btn").trigger("click");
    expect(wrapper.emitted("submit")).toHaveLength(1);
  });
});
