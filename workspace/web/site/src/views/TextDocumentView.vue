<script setup lang="ts">
import Card from "../components/Card.vue";
import ButtonBar from "../components/ButtonBar.vue";
import Button from "../components/Button.vue";
import CreateTextDocument from "../dialog/CreateTextDocumentDialog.vue";
import DeleteTextDocument from "../dialog/DeleteTextDocument.vue";
import FormatDate from "../components/FormatDate.vue";
import { useJobDb } from "../plugins/jobDb.js";
import { onMounted, ref } from "vue";
import type { TextDoc } from "@vue-offline-first/db-config";

const { getAllByType } = useJobDb();

const textDocuments = ref<TextDoc[]>([]);

const fetchDocs = () => getAllByType("text_document");

const refreshDocs = async () => {
  textDocuments.value = await fetchDocs();
};

onMounted(async () => {
  textDocuments.value = await fetchDocs();
});
</script>
<template>
  <Card>
    <h1>Text Documents</h1>
    <p>
      All of your text documents.
      <ButtonBar
        ><CreateTextDocument @created="refreshDocs">
          Create Document</CreateTextDocument
        ></ButtonBar
      >
    </p>
  </Card>
  <Card>
    <p>Total documents: {{ textDocuments.length }}</p>
    <table class="full-width-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Text</th>
          <th>Last Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in textDocuments" :key="doc._id">
          <td>{{ doc.title }}</td>
          <td>{{ doc.content }}</td>
          <td><FormatDate :date="doc.updatedAt" /></td>
          <td>
            <ButtonBar align="left">
              <Button
                variant="primary"
                size="sm"
                :to="{ name: 'document', params: { id: doc._id } }"
                >Open</Button
              >
              <DeleteTextDocument @deleted="refreshDocs" :record="doc" />
            </ButtonBar>
          </td>
        </tr>
      </tbody>
    </table>
  </Card>
</template>
<style scoped>
.full-width-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #333;
  margin-top: 1rem;
}

.full-width-table th,
.full-width-table td {
  border: 1px solid #333;
  padding: 0.75rem;
  text-align: left;
}

.full-width-table th {
  font-weight: bold;
}
</style>
