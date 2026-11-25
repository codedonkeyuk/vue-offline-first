<style scoped>
#container {
  display: flex;
  flex-direction: row;
  justify-content: center;

  & #page {
    width: 900px;
  }
}
</style>
<template>
  <div id="container">
    <div id="page">
      <slot></slot>
    </div>
  </div>
</template>
