<template><main><template>
<main class="app-shell">
<header class="topbar"><h1>ACER-Style Year 9 Test Practice</h1><p>Two timed test blocks. Questions stay in fixed order.</p></header>
<StartScreen v-if="q.screen.value==='start'" v-model:student-name="q.studentName.value" :loading="q.starting.value" :error="q.startError.value" @start="q.startTest"/>
<section v-else-if="q.screen.value==='quiz'" class="quiz-screen">
<div class="quiz-meta"><div><span>Section {{q.blockIndex.value+1}} · {{q.blockLabel.value}}</span><strong>{{q.subsectionLabel.value}} · Question {{q.questionIndex.value+1}} of {{q.totalQuestions}}</strong></div><Timer :remaining="q.remaining.value" :label="q.blockLabel.value"/></div>
<div class="progress"><div :style="{width:q.progressPercent.value+'%'}"></div></div>
<div class="question-navigator"><div class="navigator-title">Questions in this section</div>
<div class="navigator-grid"><button v-for="index in q.availableBlockIndexes.value" :key="index" type="button" class="nav-question" :class="{current:q.questionIndex.value===index,answered:q.answers.value[index]!==null,skipped:q.skipped.value[index]&&q.answers.value[index]===null}" @click="q.navigateTo(index)">{{index+1}}</button></div>
<div class="navigator-legend"><span><i class="legend current"></i>Current</span><span><i class="legend answered"></i>Answered</span><span><i class="legend skipped"></i>Skipped</span></div></div>
<QuestionCard :question="q.currentQuestion.value" :section-label="q.subsectionLabel.value" :selected="q.answers.value[q.questionIndex.value]" :locked="q.savedResponses.value.has(q.questionIndex.value)" :is-last="q.questionIndex.value===q.totalQuestions-1" :is-last-in-block="q.questionIndex.value===q.blocks[q.blockIndex.value].end" :waiting-for-questions="q.generatingQuestions.value&&q.questionIndex.value>=q.questions.value.length-1" @select="q.selectAnswer" @next="q.nextQuestion" @skip="q.skipQuestion" @previous="q.previousQuestion" @submit="q.submitTest"/>
</section>
