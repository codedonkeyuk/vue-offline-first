import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { TextDoc } from "@vue-offline-first/db-config";
import TextDocumentEditorView from "./TextDocumentEditorView.vue";

const pushMock = vi.fn();
const getByIdMock = vi.fn();
const saveTextDocMock = vi.fn();

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../plugins/jobDb.js", () => ({
  useJobDb: () => ({
    getById: getByIdMock,
    saveTextDoc: saveTextDocMock,
  }),
}));

vi.mock("../components/Card.vue", () => ({
  default: defineComponent({
    name: "Card",
    setup(_, { slots }) {
      return () => h("div", { "data-testid": "card" }, slots.default?.());
    },
  }),
}));

vi.mock("../components/ButtonBar.vue", () => ({
  default: defineComponent({
    name: "ButtonBar",
    setup(_, { slots }) {
      return () => h("div", { "data-testid": "button-bar" }, slots.default?.());
    },
  }),
}));

vi.mock("../components/Input.vue", () => ({
  default: defineComponent({
    name: "Input",
    props: ["id", "label", "modelValue"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("input", {
          "data-testid": "title-input",
          value: props.modelValue,
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLInputElement).value),
        });
    },
  }),
}));

vi.mock("../components/InputTextArea.vue", () => ({
  default: defineComponent({
    name: "InputTextArea",
    props: ["id", "label", "rows", "modelValue"],
    emits: ["update:modelValue"],
    setup(props, { emit }) {
      return () =>
        h("textarea", {
          "data-testid": "content-textarea",
          rows: props.rows,
          value: props.modelValue,
          onInput: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLTextAreaElement).value),
        });
    },
  }),
}));

vi.mock("../components/Button.vue", () => ({
  default: defineComponent({
    name: "Button",
    props: ["variant", "to"],
    emits: ["click"],
    setup(props, { slots, emit }) {
      return () =>
        h(
          "button",
          {
            "data-variant": props.variant,
            "data-to": props.to ? JSON.stringify(props.to) : undefined,
            onClick: (e: MouseEvent) => emit("click", e),
          },
          slots.default?.(),
        );
    },
  }),
}));

describe("TextDocumentEditorView", () => {
  const sampleDoc = {
    _id: "doc-1",
    type: "text_document",
    title: "Initial Title",
    content: "Initial Content",
    updatedAt: "2026-11-25T12:00:00Z",
  } as TextDoc;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountView(id?: string) {
    return shallowMount(TextDocumentEditorView, {
      props: { id },
      global: {
        stubs: {
          Card: false,
          ButtonBar: false,
          Input: false,
          InputTextArea: false,
          Button: false,
        },
      },
    });
  }

  it("does not call getById and hides editor cards when id prop is omitted", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(getByIdMock).not.toHaveBeenCalled();
    expect(wrapper.find("h1").text()).toBe("Edit Document");
    expect(wrapper.findAll("[data-testid='card']")).toHaveLength(1);
    expect(wrapper.find("[data-testid='title-input']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='content-textarea']").exists()).toBe(
      false,
    );
  });

  it("fetches document by id on mount and renders editor inputs and action buttons", async () => {
    getByIdMock.mockResolvedValue({ ...sampleDoc });
    const wrapper = mountView("doc-1");
    await flushPromises();

    expect(getByIdMock).toHaveBeenCalledTimes(1);
    expect(getByIdMock).toHaveBeenCalledWith("doc-1");

    expect(wrapper.findAll("[data-testid='card']")).toHaveLength(3);

    const titleInput = wrapper.find("[data-testid='title-input']");
    expect((titleInput.element as HTMLInputElement).value).toBe(
      "Initial Title",
    );

    const textarea = wrapper.find("[data-testid='content-textarea']");
    expect(textarea.attributes("rows")).toBe("15");
    expect((textarea.element as HTMLTextAreaElement).value).toBe(
      "Initial Content",
    );

    const closeBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Close")!;
    expect(closeBtn.attributes("data-variant")).toBe("secondary");
    expect(closeBtn.attributes("data-to")).toBe(
      JSON.stringify({ name: "main" }),
    );
  });

  it("defaults textarea value to empty string when document.content is undefined", async () => {
    getByIdMock.mockResolvedValue({
      ...sampleDoc,
      content: undefined,
    });

    const wrapper = mountView("doc-1");
    await flushPromises();

    const textarea = wrapper.find("[data-testid='content-textarea']");
    expect((textarea.element as HTMLTextAreaElement).value).toBe("");
  });

  it("updates document fields, calls saveTextDoc, and navigates to 'main' on Save click", async () => {
    getByIdMock.mockResolvedValue({ ...sampleDoc });
    saveTextDocMock.mockResolvedValue(undefined);

    const wrapper = mountView("doc-1");
    await flushPromises();

    await wrapper.find("[data-testid='title-input']").setValue("Updated Title");
    await wrapper
      .find("[data-testid='content-textarea']")
      .setValue("Updated Content");

    const saveBtn = wrapper.findAll("button").find((b) => b.text() === "Save")!;
    await saveBtn.trigger("click");
    await flushPromises();

    expect(saveTextDocMock).toHaveBeenCalledTimes(1);
    expect(saveTextDocMock).toHaveBeenCalledWith({
      ...sampleDoc,
      title: "Updated Title",
      content: "Updated Content",
    });
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith({ name: "main" });
  });
});
