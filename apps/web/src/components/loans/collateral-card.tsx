import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { COLLATERAL_CATEGORY_LABEL, COLLATERAL_STATUS_VARIANT } from "@/lib/collateral";
import { CollateralDocumentForm } from "./collateral-document-form";
import { CollateralForm } from "./collateral-form";

export type CollateralDocumentRow = {
  readonly id: string;
  readonly document_type: string;
  readonly status: string;
};

export type CollateralRow = {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly estimated_value_kobo: string | null;
  readonly valuation_method: string | null;
  readonly valuation_date: string | null;
  readonly ownership_evidence: string | null;
  readonly status: string;
  readonly release_status: string;
  readonly review_notes: string | null;
  readonly created_at: string;
  readonly collateral_documents: ReadonlyArray<CollateralDocumentRow>;
};

function date(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CollateralCard({
  applicationId,
  records,
}: {
  readonly applicationId: string;
  readonly records: ReadonlyArray<CollateralRow>;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Collateral</CardTitle>
          <p className="mt-1 max-w-xl text-[0.75rem] leading-relaxed text-muted">
            Security offered against this loan. Verification does not release it — a risk officer
            releases it only after the loan is closed.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {records.length === 0 ? (
          <p className="text-[0.75rem] text-muted">
            Nothing offered yet. Collateral is optional, but it can support a larger limit.
          </p>
        ) : (
          <ul className="space-y-3">
            {records.map((record) => (
              <li key={record.id} className="rounded-xl border border-line p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-ink-900">
                      {COLLATERAL_CATEGORY_LABEL[record.category] ?? record.category} ·{" "}
                      {record.description}
                    </p>
                    <p className="mt-0.5 text-[0.625rem] text-subtle">
                      Added {date(record.created_at)}
                      {record.estimated_value_kobo ? (
                        <>
                          {" · estimated "}
                          <Money value={BigInt(record.estimated_value_kobo)} decimals={0} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={COLLATERAL_STATUS_VARIANT[record.status] ?? "neutral"}>
                      {record.status.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant={record.release_status === "released" ? "neutral" : "info"}>
                      {record.release_status}
                    </Badge>
                  </div>
                </div>

                {record.valuation_method || record.ownership_evidence ? (
                  <dl className="mt-2 grid gap-1 text-[0.6875rem] text-muted sm:grid-cols-2">
                    {record.valuation_method ? (
                      <div>
                        <dt className="inline text-subtle">Valuation: </dt>
                        <dd className="inline">{record.valuation_method}</dd>
                      </div>
                    ) : null}
                    {record.ownership_evidence ? (
                      <div>
                        <dt className="inline text-subtle">Evidence: </dt>
                        <dd className="inline">{record.ownership_evidence}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                {record.review_notes ? (
                  <p className="mt-2 rounded-lg bg-canvas px-2.5 py-2 text-[0.6875rem] leading-relaxed text-muted">
                    Reviewer: {record.review_notes}
                  </p>
                ) : null}

                <div className="mt-3 border-t border-line pt-2.5">
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-subtle">
                    Documents
                  </p>
                  {record.collateral_documents.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {record.collateral_documents.map((document) => (
                        <li
                          key={document.id}
                          className="flex items-center justify-between gap-2 text-[0.6875rem] text-muted"
                        >
                          <span>{document.document_type}</span>
                          <Badge
                            variant={
                              document.status === "verified"
                                ? "success"
                                : document.status === "rejected"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {document.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[0.6875rem] text-subtle">No documents uploaded yet.</p>
                  )}

                  {record.release_status === "held" ? (
                    <details className="mt-2" open>
                      <summary className="cursor-pointer text-[0.6875rem] font-medium text-brand-700 hover:text-brand-800">
                        Upload a document
                      </summary>
                      <div className="mt-2">
                        <CollateralDocumentForm collateralId={record.id} />
                      </div>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-xl border border-line bg-canvas p-3.5" open>
          <summary className="cursor-pointer text-[0.8125rem] font-medium text-ink-900">
            Add collateral
          </summary>
          <div className="mt-3">
            <CollateralForm applicationId={applicationId} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
