import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";
import { BasicFormFields } from "@/components/providers/forms/BasicFormFields";
import { Form } from "@/components/ui/form";
import type { ProviderFormData } from "@/lib/schemas/provider";

function BasicFormFieldsHarness() {
  const form = useForm<ProviderFormData>({
    defaultValues: {
      name: "Provider",
      websiteUrl: "",
      notes: "",
      settingsConfig: "{}",
      icon: "openai",
      iconColor: "#10A37F",
    },
  });

  return (
    <Form {...form}>
      <form>
        <BasicFormFields form={form} />
      </form>
    </Form>
  );
}

describe("BasicFormFields", () => {
  it("does not render the logo picker entry in provider forms", () => {
    const { container } = render(<BasicFormFieldsHarness />);

    expect(container.querySelector("button[title]")).not.toBeInTheDocument();
  });

  it("renders the basic fields in a tighter responsive grid", () => {
    render(<BasicFormFieldsHarness />);

    const nameInput = screen.getByLabelText("provider.name");
    const nameRow = nameInput.parentElement?.parentElement;
    const nameGrid = nameRow?.parentElement;
    const nameLabel = screen.getByText("provider.name");
    const notesLabel = screen.getByText("provider.notes");
    const websiteLabel = screen.getByText("provider.websiteUrl");

    expect(nameGrid).toHaveClass("md:grid-cols-3");
    expect(nameGrid).not.toHaveClass("grid-cols-3");
    expect(nameRow).toHaveClass("items-center");
    expect(nameInput.parentElement).toHaveClass("space-y-0.5");
    expect(nameLabel).not.toHaveClass("text-xs");
    expect(notesLabel).not.toHaveClass("text-xs");
    expect(websiteLabel).not.toHaveClass("text-xs");
    expect(nameLabel).toHaveClass("leading-8");
  });

  it("keeps the provider name row aligned to the same label column width as endpoint fields", () => {
    render(<BasicFormFieldsHarness />);

    const nameInput = screen.getByLabelText("provider.name");
    const nameRow = nameInput.parentElement?.parentElement;

    expect(nameRow).toHaveClass("grid-cols-[96px_minmax(0,1fr)]");
  });
});
