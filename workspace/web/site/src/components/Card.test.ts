import { shallowMount } from "@vue/test-utils";
import { defineComponent } from "vue";
import Card from "./Card.vue";

describe("Card", () => {
  it("renders a <div> with the card class", () => {
    const wrapper = shallowMount(Card);

    expect(wrapper.element.tagName).toBe("DIV");
    expect(wrapper.classes()).toEqual(["card"]);
  });

  it("renders text slot content", () => {
    const wrapper = shallowMount(Card, {
      slots: {
        default: "Card content",
      },
    });

    expect(wrapper.text()).toBe("Card content");
  });

  it("shallow-stubs child components passed into the default slot", () => {
    const FakeChild = defineComponent({
      name: "ChildComponent",
      template: "<span>Real Child</span>",
    });

    const wrapper = shallowMount(Card, {
      slots: {
        default: FakeChild,
      },
    });

    expect(wrapper.findComponent(FakeChild).exists()).toBe(true);
    expect(wrapper.html()).toContain("child-component-stub");
  });
});
