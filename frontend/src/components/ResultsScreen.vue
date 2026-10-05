<template>
  <section class="card results-screen">
    <div class="result-icon">🏆</div>
    <div class="eyebrow">TEST COMPLETE</div>
    <h2>{{ title }}</h2>
    <div class="score-ring" :style="{ '--score': score + '%' }"><span>{{ score }}%</span></div>
    <div class="stats-grid">
      <div><strong>{{ correct }}</strong><span>Correct</span></div>
      <div><strong>{{ incorrect }}</strong><span>Incorrect</span></div>
      <div><strong>{{ timeouts }}</strong><span>Timed out</span></div>
      <div><strong>{{ averageTime }}s</strong><span>Avg. response</span></div>
    </div>
    <div class="breakdown">
      <h3>Section Breakdown</h3>
      <div v-for="row in breakdown" :key="row.section" class="breakdown-row">
        <span>{{ row.label }}</span><strong>{{ row.correct }}/{{ row.total }}</strong><span>{{ row.average }}s avg</span>
      </div>
    </div>
    <div class="action-row center">
      <button class="primary-btn" type="button" @click="$emit('restart')">Restart Assessment</button>
    </div>
  </section>
</template>
<script setup>
defineProps({
  title:{type:String,required:true},score:{type:Number,required:true},correct:{type:Number,required:true},
  incorrect:{type:Number,required:true},timeouts:{type:Number,required:true},averageTime:{type:String,required:true},
  breakdown:{type:Array,required:true}
});
defineEmits(["restart"]);
</script>