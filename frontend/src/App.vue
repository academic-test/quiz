<template>
<main class="app-shell">
<header class="topbar"><h1>ACER-Style Year 9 Test Practice</h1><p>Two timed test blocks.</p></header>
<StartScreen v-if="screen==='start'" v-model:student-name="studentName" :loading="starting" :error="startError" @start="startTest"/>
<section v-else-if="screen==='quiz'" class="quiz-screen">
<div class="quiz-meta"><div><span>Section {{blockIndex+1}} · {{blockLabel}}</span><strong>{{subsectionLabel}} · Question {{questionIndex+1}} of {{totalQuestions}}</strong></div><Timer :remaining="remaining" :label="blockLabel"/></div>
<div class="progress"><div :style="{width:progressPercent+'%'}"></div></div>
<div class="question-navigator">
<div class="navigator-title">Questions in this section</div>
<div class="navigator-grid"><button v-for="index in availableBlockIndexes" :key="index" type="button" class="nav-question" :class="{current:questionIndex===index,answered:answers[index]!==null,skipped:skipped[index]&&answers[index]===null}" @click="navigateTo(index)">{{index+1}}</button></div>
</div>
<QuestionCard :question="currentQuestion" :section-label="subsectionLabel" :selected="answers[questionIndex]" :locked="savedResponses.has(questionIndex)" :is-last="questionIndex===totalQuestions-1" :is-last-in-block="questionIndex===blocks[blockIndex].end" :waiting-for-questions="generatingQuestions&&questionIndex>=questions.length-1" @select="selectAnswer" @next="nextQuestion" @skip="skipQuestion" @previous="previousQuestion" @submit="submitTest"/>
</section>
<ResultsScreen v-else :title="resultTitle" :score="resultStats.score" :correct="resultStats.correct" :incorrect="resultStats.incorrect" :timeouts="resultStats.timeouts" :skipped="resultStats.skipped" :average-time="resultStats.averageTime" :breakdown="resultStats.breakdown" @restart="reset"/>
</main>
</template>