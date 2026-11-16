export interface BaseDoc {
  _id?: string;
  _rev?: string;
  type: "cover_letter" | "cv" | "job_application";
  title: string;
  content?: string;
  updatedAt: string;
}

export interface CoverLetterDoc extends BaseDoc {
  type: "cover_letter";
  coverLetterId: string;
}

export interface CvDoc extends BaseDoc {
  type: "cv";
  cvId: string;
}

export interface JobApplicationDoc extends BaseDoc {
  type: "job_application";
}

export type AppDocument = CoverLetterDoc | CvDoc | JobApplicationDoc;
