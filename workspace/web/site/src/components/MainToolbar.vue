<style scoped>
#main-toolbar {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  background-color: var(--main-toolbar);
  margin-bottom: 10px;
  min-height: 30px;
}
#options {
  display: flex;
  flex-direction: row;
  gap: 5px;
  padding: 5px;
}
</style>
<template>
  <nav id="main-toolbar">
    <div id="logo"></div>
    <div id="options">
      <button>Setting</button>
    </div>
  </nav>
</template>
