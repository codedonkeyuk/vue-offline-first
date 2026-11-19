<style scoped>
#container {
  display: flex;
  flex-direction: row;
  justify-content: center;

  & #page {
    width: 900px;
    background: var(--page-color);
    color: var(--main-color);
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
