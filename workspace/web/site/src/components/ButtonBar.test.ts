import { shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";
import ButtonBar from "./ButtonBar.vue";

describe("ButtonBar", () => {
  it("renders a <div> with default classes and right alignment", () => {
    const wrapper = shallowMount(ButtonBar);

    expect(wrapper.element.tagName).toBe("DIV");
    expect(wrapper.classes()).toEqual(["button-bar", "button-bar--right"]);
  });

  it.each(["left", "center", "right"] as const)(
    "applies button-bar--%s class when align prop is %s",
    (align) => {
      const wrapper = shallowMount(ButtonBar, {
        props: { align },
      });

      expect(wrapper.classes()).toEqual(["button-bar", `button-bar--${align}`]);
    },
  );

  it("renders slot content while shallow-stubbing child components", () => {
    const FakeChildButton = defineComponent({
      name: "Button",
      template: "<button>Real Child</button>",
    });

    const wrapper = shallowMount(ButtonBar, {
      slots: {
        default: FakeChildButton,
      },
    });

    // Verifies slot renders without executing child component internals
    expect(wrapper.findComponent(FakeChildButton).exists()).toBe(true);
    expect(wrapper.html()).toContain("button-stub");
  });
});
