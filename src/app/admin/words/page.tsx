import { ActionForm } from "@/components/staff/action-form";
import { getStaffSiteText } from "@/lib/dal/content";
import { siteTextFields } from "@/lib/site-text";
import { saveSiteText } from "../actions";

export const instant = false;

export default async function WordsPage() {
  const text = await getStaffSiteText();
  const sections = [...new Set(siteTextFields.map((field) => field.section))];

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Public website</p>
          <h1 className="dashboard-title">Words</h1>
        </div>
      </header>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-ink/60">
        Write the story, the barista introduction and the short lines around the
        menu in your own words. Changes appear on the website when you save.
      </p>
      <ActionForm action={saveSiteText} className="max-w-3xl" submitLabel="Save words">
        {sections.map((section) => (
          <fieldset className="dashboard-panel grid gap-4" key={section}>
            <legend className="eyebrow px-2 text-olive">{section}</legend>
            {siteTextFields
              .filter((field) => field.section === section)
              .map((field) => (
                <label key={field.key}>
                  {field.label}
                  {"multiline" in field && field.multiline ? (
                    <textarea
                      name={field.key}
                      rows={field.maxLength > 600 ? 8 : 3}
                      maxLength={field.maxLength}
                      defaultValue={text[field.key]}
                    />
                  ) : (
                    <input name={field.key} maxLength={field.maxLength} defaultValue={text[field.key]} />
                  )}
                  {"hint" in field ? (
                    <small className="font-normal normal-case tracking-normal text-ink/45">{field.hint}</small>
                  ) : null}
                </label>
              ))}
          </fieldset>
        ))}
      </ActionForm>
    </main>
  );
}
