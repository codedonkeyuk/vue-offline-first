import { shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";
import Container from "./Container.vue";

describe("Container", () => {
  it("renders the outer #container and inner #page wrapper divs", () => {
    const wrapper = shallowMount(Container);

    expect(wrapper.element.tagName).toBe("DIV");
    expect(wrapper.attributes("id")).toBe("container");

    const page = wrapper.find("#page");
    expect(page.exists()).toBe(true);
    expect(page.element.tagName).toBe("DIV");
  });

  it("renders slot content inside #page", () => {
    const wrapper = shallowMount(Container, {
      slots: {
        default: "Page content",
      },
    });

    const page = wrapper.find("#page");
    expect(page.text()).toBe("Page content");
  });

  it("shallow-stubs child components passed into the slot inside #page", () => {
    const FakeChild = defineComponent({
      name: "PageView",
      template: "<section>Real View</section>",
    });

    const wrapper = shallowMount(Container, {
      slots: {
        default: FakeChild,
      },
    });

    const page = wrapper.find("#page");
    expect(page.findComponent(FakeChild).exists()).toBe(true);
    expect(page.html()).toContain("page-view-stub");
  });
});
