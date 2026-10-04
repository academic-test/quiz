<template>
  <article class="card question-card">
    <div class="question-head">
      <span class="tag">{{ sectionLabel }}</span>
      <span class="difficulty">{{ question.difficulty }}</span>
    </div>
    <div v-if="question.passage" class="passage">{{ question.passage }}</div>
    <div class="question-text">{{ question.q }}</div>
    <div class="options">
      <button v-for="(option, index) in question.o" :key="index" class="option"
        :class="{ selected: selected === index, correct: submitted && index === correctAnswer,
                  incorrect: submitted && selected === index && index !== correctAnswer }"
        type="button" :disabled="submitted" @click="$emit('select', index)">
        <span class="letter">{{ String.fromCharCode(65 + index) }}</span><span>{{ option }}</span>
      </button>
    </div>
    <div v-if="submitted" class="feedback" :class="feedbackClass">{{ feedbackText }}</div>
    <div class="action-row">
      <button v-if="submitted" class="secondary-btn" type="button" @click="$emit('next')">
        {{ isLast ? "See Results →" : "Next Question →" }}
      </button>
    </div>
  </article>
</template>
<script setup>
import { computed } from "vue";
const props=defineProps({
  question:{type:Object,required:true}, sectionLabel:{type:String,required:true},
  selected:{type:Number,default:null}, submitted:{type:Boolean,default:false},
  correctAnswer:{type:Number,default:null}, feedback:{type:Object,default:null},
  isLast:{type:Boolean,default:false}
});
defineEmits(["select","submit","next"]);
const feedbackClass=computed(()=>props.feedback?(props.feedback.timeout?"timeout":props.feedback.correct?"good":"bad"):"");
const feedbackText=computed(()=>{
  if(!props.feedback)return "";
  const letter=String.fromCharCode(65+props.feedback.correctAnswer);
  if(props.feedback.timeout)return "Time’s up. Correct answer: "+letter+". "+props.feedback.explanation;
  if(props.feedback.correct)return "Correct! "+props.feedback.explanation;
  return "Not quite. Correct answer: "+letter+". "+props.feedback.explanation;
});
</script>