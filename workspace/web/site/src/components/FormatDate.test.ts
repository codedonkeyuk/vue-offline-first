import { shallowMount } from "@vue/test-utils";
import FormatDate from "./FormatDate.vue";

describe("FormatDate", () => {
  let formatSpy: ReturnType<typeof vi.fn<(date?: Date | number) => string>>;
  let dateTimeFormatSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    formatSpy = vi.fn(() => "MOCKED_DATE");
    dateTimeFormatSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(function () {
        return { format: formatSpy } as unknown as Intl.DateTimeFormat;
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a <time> element with datetime attribute and formatted text", () => {
    const isoDate = "2026-11-25T16:10:00Z";
    const wrapper = shallowMount(FormatDate, {
      props: { date: isoDate },
    });

    expect(wrapper.element.tagName).toBe("TIME");
    expect(wrapper.attributes("datetime")).toBe(isoDate);
    expect(wrapper.text()).toBe("MOCKED_DATE");
  });

  it("defaults to locale 'en-GB' and includes short time", () => {
    const isoDate = "2026-11-25T16:10:00Z";
    shallowMount(FormatDate, {
      props: { date: isoDate },
    });

    expect(dateTimeFormatSpy).toHaveBeenCalledWith("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(formatSpy).toHaveBeenCalledWith(new Date(isoDate));
  });

  it("omits timeStyle when includeTime is false", () => {
    const isoDate = "2026-11-25T16:10:00Z";
    shallowMount(FormatDate, {
      props: {
        date: isoDate,
        includeTime: false,
      },
    });

    expect(dateTimeFormatSpy).toHaveBeenCalledWith("en-GB", {
      dateStyle: "medium",
      timeStyle: undefined,
    });
  });

  it("passes custom locale prop to Intl.DateTimeFormat", () => {
    const isoDate = "2026-11-25T16:10:00Z";
    shallowMount(FormatDate, {
      props: {
        date: isoDate,
        locale: "en-US",
      },
    });

    expect(dateTimeFormatSpy).toHaveBeenCalledWith("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  });
});
