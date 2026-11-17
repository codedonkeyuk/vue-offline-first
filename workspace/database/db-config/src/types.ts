export interface BaseDoc {
  _id?: string;
  _rev?: string;
  type: "text_document";
  title: string;
  content?: string;
  updatedAt: string;
}

export interface TextDoc extends BaseDoc {
  type: "text_document";
}

export type AppDocument = TextDoc;
