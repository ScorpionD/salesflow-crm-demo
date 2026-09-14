import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Database,
  GitBranch,
  Layers,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { api, ApiError } from './services/api';
import {
  type Bootstrap,
  type CRMRecord,
  type Kind,
  type Role,
  labels,
  roleNames,
  titleCase,
  money,
} from './types';
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function Spinner({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {label}
    </div>
  );
}
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = 'Nothing here yet',
  text = 'Add a record to get started.',
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Layers size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = useId();
  useEffect(() => {
    const d = ref.current,
      previous = document.activeElement as HTMLElement;
    d?.showModal();
    return () => {
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function SearchField({
  value,
  onChange,
  label = 'Search',
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label + '…'}
        maxLength={100}
      />
    </label>
  );
}
export function BusinessBlocks() {
  return (
    <div className="business-blocks">
      <section>
        <p className="eyebrow">WHAT THIS DEMO SOLVES</p>
        <h2>From a first conversation to a closed deal.</h2>
        <p>
          Connect contacts and companies, move opportunities through a clear sales pipeline, and
          keep tasks, activities and team reporting in one place.
        </p>
      </section>
      <section>
        <p className="eyebrow">PRODUCTION-STYLE FEATURES</p>
        <div className="feature-grid">
          {[
            'PostgreSQL persistence',
            'Role-based permissions',
            'Private demo workspaces',
            'Validated pipeline logic',
            'Live updates across tabs',
            'Activity & audit history',
            'n8n → Telegram automation',
            'Server validation',
            'Responsive interface',
            'Automated tests',
          ].map((t) => (
            <span key={t}>
              <Check size={15} />
              {t}
            </span>
          ))}
        </div>
      </section>
      <section className="design-story">
        <p className="eyebrow">DESIGNED AND BUILT END TO END</p>
        <h2>Business process → UX → Figma → Production</h2>
        <p>
          A focused design system becomes a React interface, connected to a Node.js API, PostgreSQL
          and a deployed automation workflow.
        </p>
        <div className="architecture-flow">
          {[
            [Layers, 'Figma + React'],
            [ShieldCheck, 'Cloudflare gateway'],
            [Database, 'Node.js + PostgreSQL'],
            [GitBranch, 'SSE + n8n + Telegram'],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Layers;
            return (
              <span key={String(label)}>
                <I size={20} />
                {String(label)}
              </span>
            );
          })}
        </div>
        <div className="link-row">
          <a
            href="https://www.figma.com/design/tHCwZwV8Mv5jjPOOVf4UPG/SalesFlow-CRM--Portfolio-Design"
            target="_blank"
            rel="noreferrer"
          >
            View Figma design <ArrowRight size={14} />
          </a>
          <a
            href="https://github.com/ScorpionD/salesflow-crm-demo"
            target="_blank"
            rel="noreferrer"
          >
            Explore the code <ArrowRight size={14} />
          </a>
        </div>
      </section>
      <section>
        <p className="eyebrow">BUILT FOR CUSTOMIZATION</p>
        <h2>Designed around the way your team sells.</h2>
        <p>
          Adaptable for sales teams, B2B services, agencies, account management, customer success,
          real estate and automotive businesses.
        </p>
        <p className="muted">
          Possible future integrations: HubSpot, Salesforce, Gmail, Outlook, Slack, WhatsApp, Google
          or Microsoft Calendar, Stripe and custom APIs. These integrations are not connected in
          this demo.
        </p>
      </section>
    </div>
  );
}
export function Login({
  enter,
  busy,
  error,
}: {
  enter: (r: Role) => void;
  busy: boolean;
  error: unknown;
}) {
  return (
    <div className="landing">
      <header className="landing-header">
        <a className="brand" href="#">
          <span>S</span>SalesFlow
        </a>
        <Badge>WORKING CRM DEMO</Badge>
      </header>
      <main>
        <div className="hero">
          <h1>
            Better sales conversations.
            <br />
            <em>A clearer path to won.</em>
          </h1>
          <p>Contacts, deals and next actions — connected in one focused workspace.</p>
          <p className="muted">
            Choose a role. Explore a private, fictional sales dataset. No sign-up needed.
          </p>
        </div>
        {Boolean(error) && <ErrorBox error={error} />}
        <div className="role-grid">
          {(['manager', 'representative', 'viewer'] as Role[]).map((r, i) => (
            <article className="role-card" key={r}>
              <Badge>{['FULL WORKSPACE', 'YOUR OPPORTUNITIES', 'READ ONLY'][i]}</Badge>
              <h2>{roleNames[r]}</h2>
              <p>
                {
                  [
                    'Manage deals, assignments and reports. Review the team and Won automation.',
                    'Work your deals, tasks and follow-ups. Update stages and add useful notes.',
                    'Explore pipeline and team activity. All changes are blocked on the server.',
                  ][i]
                }
              </p>
              <button className="primary" disabled={busy} onClick={() => enter(r)}>
                {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}Enter
                as{' '}
                {r === 'manager' ? 'Manager' : r === 'representative' ? 'Representative' : 'Viewer'}
              </button>
            </article>
          ))}
        </div>
        <p className="privacy-line">
          <ShieldCheck size={16} />
          Private demo workspace · 24-hour retention · Fictional data only
        </p>
        <BusinessBlocks />
      </main>
      <footer>SalesFlow CRM · A working full-stack portfolio demo</footer>
    </div>
  );
}
type FormProps = {
  kind: Kind;
  record?: CRMRecord;
  defaults?: Partial<CRMRecord>;
  data: Bootstrap;
  onClose: () => void;
  onSaved: (r: CRMRecord) => void;
};
export function RecordForm({ kind, record, defaults, data, onClose, onSaved }: FormProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [fields, setFields] = useState<Record<string, string>>({});
  const base: any = {
    owner_id: data.session.member_id,
    status: kind === 'tasks' ? 'open' : 'lead',
    priority: 'medium',
    source: 'Website',
    currency: 'USD',
    expected_close: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    due_at: new Date(Date.now() + 86400000).toISOString(),
    value: 0,
    ...defaults,
    ...record,
  };
  const [company, setCompany] = useState(base.company_id || '');
  const owners = data.members.filter(
    (m) =>
      m.active &&
      m.role !== 'viewer' &&
      (data.session.role === 'manager' || m.id === data.session.member_id),
  );
  const input = (name: string, label: string, type = 'text', required = false, max = 120) => (
    <label className={'field ' + (fields[name] ? 'invalid' : '')} key={name}>
      {label}
      {required ? ' *' : ''}
      <input
        name={name}
        type={type}
        defaultValue={base[name] ?? ''}
        required={required}
        maxLength={max}
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? 100000000 : undefined}
        step={type === 'number' ? '0.01' : undefined}
        aria-invalid={!!fields[name]}
      />
      {fields[name] && <small>{fields[name]}</small>}
    </label>
  );
  const select = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
    required = false,
  ) => (
    <label className="field" key={name}>
      {label}
      {required ? ' *' : ''}
      <select
        name={name}
        defaultValue={base[name] || ''}
        required={required}
        aria-invalid={!!fields[name]}
      >
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {fields[name] && <small className="field-error">{fields[name]}</small>}
    </label>
  );
  const opt = (values: string[]) => values.map((value) => ({ value, label: titleCase(value) }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setFields({});
    const f = Object.fromEntries(new FormData(e.currentTarget)),
      body: any = { ...f };
    if (kind === 'deals') body.value = Number(body.value);
    for (const k of ['company_id', 'contact_id']) if (k in body) body[k] = body[k] || null;
    if (kind === 'tasks') {
      body.due_at = new Date(String(body.due_at)).toISOString();
      const [relatedKind, relatedId] = String(body.related || '').split(':');
      delete body.related;
      for (const k of ['company', 'contact', 'deal'])
        body[k + '_id'] = k === relatedKind ? relatedId : null;
    }
    if (record) body.version = record.version;
    try {
      const result = await api<{ record: CRMRecord }>(
        '/' + kind + (record ? '/' + record.id : ''),
        record ? 'PATCH' : 'POST',
        body,
      );
      onSaved(result.record);
    } catch (err) {
      setError(err);
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={(record ? 'Edit ' : 'Add ') + labels[kind]} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {Boolean(error) && <ErrorBox error={error} />}
          <p className="muted small">
            Use fictional details in this temporary demo. * Required fields
          </p>
          <div className="form-grid">
            {input(
              kind === 'contacts' || kind === 'companies' ? 'name' : 'title',
              kind === 'contacts'
                ? 'Full name'
                : kind === 'companies'
                  ? 'Company name'
                  : kind === 'deals'
                    ? 'Deal title'
                    : 'Task title',
              'text',
              true,
              150,
            )}
            {kind === 'contacts' && (
              <>
                {input('email', 'Email', 'email', true, 180)}
                {input('phone', 'Phone', 'tel', false, 40)}
                {input('job_title', 'Job title')}
                {select('status', 'Status', opt(['lead', 'active', 'customer']), true)}
                {input('source', 'Source')}
              </>
            )}
            {kind === 'companies' && (
              <>
                {input('website', 'Website URL', 'url', false, 250)}
                {input('industry', 'Industry')}
                {select('size', 'Company size', [
                  { value: '', label: 'Not specified' },
                  ...opt(['1–10', '11–50', '51–200', '201–500', '500+']),
                ])}
                {input('phone', 'Phone', 'tel', false, 40)}
                {input('address', 'Address', 'text', false, 240)}
              </>
            )}
            {(kind === 'deals' || kind === 'contacts') && (
              <label className="field">
                Company{kind === 'deals' ? ' *' : ''}
                <select
                  name="company_id"
                  required={kind === 'deals'}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  <option value="">{kind === 'deals' ? 'Choose company' : 'No company'}</option>
                  {data.companies
                    .filter((c) => !c.archived)
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {fields.company_id && <small className="field-error">{fields.company_id}</small>}
              </label>
            )}
            {kind === 'deals' && (
              <>
                {select('contact_id', 'Contact', [
                  { value: '', label: 'No contact' },
                  ...data.contacts
                    .filter((c) => !c.archived && c.company_id === company)
                    .map((c) => ({ value: c.id, label: c.name! })),
                ])}
                {input('value', 'Deal value (USD)', 'number', true)}
                {input('expected_close', 'Expected close', 'date', true)}
                {input('next_action', 'Next action', 'text', false, 240)}
              </>
            )}
            {select(
              'owner_id',
              kind === 'tasks' ? 'Assigned to' : 'Owner',
              owners.map((m) => ({ value: m.id, label: m.name })),
              true,
            )}
            {(kind === 'deals' || kind === 'tasks') &&
              select('priority', 'Priority', opt(['low', 'medium', 'high']), true)}
            {kind === 'tasks' && (
              <>
                <label className="field">
                  Due date & time *
                  <input
                    type="datetime-local"
                    name="due_at"
                    required
                    defaultValue={new Date(
                      new Date(base.due_at).getTime() -
                        new Date(base.due_at).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                  />
                  <small>Your local timezone</small>
                </label>
                {select('status', 'Status', opt(['open', 'in_progress', 'completed']), true)}
                <label className="field">
                  Related record
                  <select
                    name="related"
                    defaultValue={
                      base.deal_id
                        ? 'deal:' + base.deal_id
                        : base.contact_id
                          ? 'contact:' + base.contact_id
                          : base.company_id
                            ? 'company:' + base.company_id
                            : ''
                    }
                  >
                    <option value="">No linked record</option>
                    {(['deals', 'contacts', 'companies'] as Kind[]).map((k) => (
                      <optgroup key={k} label={titleCase(k)}>
                        {data[k]
                          .filter((r) => !r.archived)
                          .map((r) => (
                            <option value={labels[k] + ':' + r.id} key={r.id}>
                              {r.title || r.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </>
            )}
            {kind !== 'tasks' && (
              <label className="field full">
                Notes
                <textarea name="notes" defaultValue={base.notes || ''} maxLength={2000} rows={3} />
                {fields.notes && <small className="field-error">{fields.notes}</small>}
              </label>
            )}
          </div>
        </div>
        <footer>
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Save{' '}
            {labels[kind]}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function StageForm({
  record,
  data,
  onClose,
  onSaved,
}: {
  record: CRMRecord;
  data: Bootstrap;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState(record.stage || 'new'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/deals/' + record.id + '/stage', 'POST', {
        stage,
        version: record.version,
        ...(stage === 'lost'
          ? { lost_reason: new FormData(e.currentTarget).get('lost_reason') }
          : {}),
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Move deal to another stage" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <h3>{record.title}</h3>
          <p>
            {money(record.value)} · Current stage: {titleCase(record.stage)}
          </p>
          {Boolean(error) && <ErrorBox error={error} />}
          <label className="field">
            Stage
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {data.stages.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {stage === 'lost' && (
            <label className="field">
              Reason for loss *
              <textarea name="lost_reason" minLength={3} maxLength={500} required rows={3} />
            </label>
          )}
          {stage === 'won' && (
            <p className="notice">
              This records the win and queues one Telegram manager notification through n8n. Use
              fictional deal details.
            </p>
          )}
          <p className="muted small">
            The stage change and activity are saved together. A stale edit is rejected so another
            tab’s update is preserved.
          </p>
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || stage === record.stage}>
            {busy ? 'Saving…' : 'Confirm ' + titleCase(stage)}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
