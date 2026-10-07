import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MathematicsScienceGroup from "../src/components/MathematicsScienceGroup.vue";

const questions = [
  { id: "q41", q: "Which value is correct?", o: ["A", "B", "C", "D"] },
  { id: "q42", q: "Which pattern follows?", o: ["A", "B", "C", "D"] },
  { id: "q43", q: "What is the best conclusion?", o: ["A", "B", "C", "D"] },
  { id: "q44", q: "Which result is supported?", o: ["A", "B", "C", "D"] }
];

const baseProps = {
  questions,
  pageNumber: 1,
  questionStart: 41,
  questionEnd: 44,
  totalQuestions: 32,
  answers: {},
  answeredCount: 0,
  unansweredCount: 4
};

describe("MathematicsScienceGroup", () => {
  it("renders multiple Mathematics & Science questions on one page", () => {
    const wrapper = mount(MathematicsScienceGroup, { props: baseProps });

    expect(wrapper.findAll(".stimulus-question")).toHaveLength(4);
    expect(wrapper.text()).toContain("Problem page · 1");
    expect(wrapper.text()).toContain("Questions 41–44 of 32");

    const review = wrapper.find("button.review-submit-btn");
    expect(review.text()).toContain("Save Answer & Review");
    expect(review.attributes("disabled")).toBeDefined();
  });

  it("keeps all feedback on the same page and changes the same button to Next Page", () => {
    const results = Object.fromEntries(
      questions.map((question, index) => [
        question.id,
        {
          correct: index % 2 === 0,
          feedback: { correctAnswer: 1, explanation: "Explanation for " + question.id }
        }
      ])
    );

    const wrapper = mount(MathematicsScienceGroup, {
      props: {
        ...baseProps,
        answers: Object.fromEntries(questions.map(question => [question.id, 1])),
        answeredCount: 4,
        unansweredCount: 0,
        pageReviewed: true,
        results
      }
    });

    expect(wrapper.findAll(".stimulus-feedback")).toHaveLength(4);
    expect(wrapper.findAll(".stimulus-feedback-explanation")).toHaveLength(4);
    expect(wrapper.text()).toContain("Explanation for q41");
    expect(wrapper.text()).toContain("Explanation for q44");
    expect(wrapper.find("button.review-submit-btn").text()).toContain("Next Page");

    const questionNavButtons = wrapper.findAll(".question-nav");
    expect(questionNavButtons).toHaveLength(0);
  });

  it("uses Save Answer & Review until the explicit page review state is true", () => {
    const results = Object.fromEntries(
      questions.map(question => [
        question.id,
        { correct: true, feedback: { correctAnswer: 0, explanation: "Reviewed" } }
      ])
    );

    const wrapper = mount(MathematicsScienceGroup, {
      props: {
        ...baseProps,
        answers: Object.fromEntries(questions.map(question => [question.id, 0])),
        answeredCount: 4,
        unansweredCount: 0,
        results,
        pageReviewed: false
      }
    });

    expect(wrapper.find("button.review-submit-btn").text()).toContain("Save Answer & Review");
  });
});
