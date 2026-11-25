import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { TextDoc } from "@vue-offline-first/db-config";
import TextDocumentView from "./TextDocumentView.vue";

const getAllByTypeMock = vi.fn();

vi.mock("../plugins/jobDb.js", () => ({
  useJobDb: () => ({
    getAllByType: getAllByTypeMock,
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
    props: ["align"],
    setup(props, { slots }) {
      return () =>
        h(
          "div",
          { "data-testid": "button-bar", "data-align": props.align },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock("../components/Button.vue", () => ({
  default: defineComponent({
    name: "Button",
    props: ["variant", "size", "to"],
    setup(props, { slots }) {
      return () =>
        h(
          "a",
          {
            "data-testid": "open-button",
            "data-variant": props.variant,
            "data-size": props.size,
            "data-to": props.to ? JSON.stringify(props.to) : undefined,
          },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock("../dialog/CreateTextDocumentDialog.vue", () => ({
  default: defineComponent({
    name: "CreateTextDocument",
    emits: ["created"],
    setup(_, { slots, emit }) {
      return () =>
        h(
          "button",
          {
            "data-testid": "create-dialog-stub",
            onClick: () => emit("created"),
          },
          slots.default?.(),
        );
    },
  }),
}));

vi.mock("../dialog/DeleteTextDocument.vue", () => ({
  default: defineComponent({
    name: "DeleteTextDocument",
    props: ["record"],
    emits: ["deleted"],
    setup(props, { emit }) {
      return () =>
        h(
          "button",
          {
            "data-testid": "delete-dialog-stub",
            "data-record-id": props.record?._id,
            onClick: () => emit("deleted"),
          },
          "Delete",
        );
    },
  }),
}));

vi.mock("../components/FormatDate.vue", () => ({
  default: defineComponent({
    name: "FormatDate",
    props: ["date"],
    setup(props) {
      return () => h("time", { "data-testid": "format-date" }, props.date);
    },
  }),
}));

describe("TextDocumentView", () => {
  const sampleDocs: TextDoc[] = [
    {
      _id: "doc-1",
      type: "text_document",
      title: "First Note",
      content: "Alpha content",
      updatedAt: "2026-11-25T10:00:00Z",
    } as TextDoc,
    {
      _id: "doc-2",
      type: "text_document",
      title: "Second Note",
      content: "Beta content",
      updatedAt: "2026-11-25T12:30:00Z",
    } as TextDoc,
  ];

  beforeEach(() => {
    getAllByTypeMock.mockReset();
  });

  function mountView() {
    return shallowMount(TextDocumentView, {
      global: {
        stubs: {
          Card: false,
          ButtonBar: false,
          Button: false,
          CreateTextDocument: false,
          DeleteTextDocument: false,
          FormatDate: false,
        },
      },
    });
  }

  it("fetches 'text_document' records on mount and displays empty table state when none exist", async () => {
    getAllByTypeMock.mockResolvedValue([]);
    const wrapper = mountView();
    await flushPromises();

    expect(getAllByTypeMock).toHaveBeenCalledTimes(1);
    expect(getAllByTypeMock).toHaveBeenCalledWith("text_document");
    expect(wrapper.text()).toContain("Total documents: 0");
    expect(wrapper.findAll("tbody tr")).toHaveLength(0);
  });

  it("renders a table row for each document with title, content, FormatDate, Open link, and Delete dialog", async () => {
    getAllByTypeMock.mockResolvedValue(sampleDocs);
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("Total documents: 2");

    const rows = wrapper.findAll("tbody tr");
    expect(rows).toHaveLength(2);

    const firstRowCells = wrapper.find("tbody tr").findAll("td");
    expect(firstRowCells.at(0)!.text()).toBe("First Note");
    expect(firstRowCells.at(1)!.text()).toBe("Alpha content");
    expect(
      firstRowCells.at(2)!.find("[data-testid='format-date']").text(),
    ).toBe("2026-11-25T10:00:00Z");

    const openBtn = firstRowCells.at(3)!.find("[data-testid='open-button']");
    expect(openBtn.text()).toBe("Open");
    expect(openBtn.attributes("data-variant")).toBe("primary");
    expect(openBtn.attributes("data-size")).toBe("sm");
    expect(openBtn.attributes("data-to")).toBe(
      JSON.stringify({ name: "document", params: { id: "doc-1" } }),
    );

    const deleteStub = firstRowCells
      .at(3)!
      .find("[data-testid='delete-dialog-stub']");
    expect(deleteStub.exists()).toBe(true);
    expect(deleteStub.attributes("data-record-id")).toBe("doc-1");
  });

  it("re-fetches documents when CreateTextDocument emits 'created'", async () => {
    getAllByTypeMock
      .mockResolvedValueOnce(sampleDocs.slice(0, 1))
      .mockResolvedValueOnce(sampleDocs);

    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("Total documents: 1");

    await wrapper.find("[data-testid='create-dialog-stub']").trigger("click");
    await flushPromises();

    expect(getAllByTypeMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Total documents: 2");
  });

  it("re-fetches documents when DeleteTextDocument emits 'deleted'", async () => {
    getAllByTypeMock
      .mockResolvedValueOnce(sampleDocs)
      .mockResolvedValueOnce(sampleDocs.slice(0, 1));

    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("Total documents: 2");

    await wrapper.find("[data-testid='delete-dialog-stub']").trigger("click");
    await flushPromises();

    expect(getAllByTypeMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Total documents: 1");
  });
});
