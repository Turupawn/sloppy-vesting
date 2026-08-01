export function Row(props: {
  label: string;
  value: string;
  testid: string;
  /** If present, the value is a link (e.g. to the explorer). */
  href?: string;
}) {
  return (
    <div className="book__row">
      <span className="book__label">{props.label}</span>
      {props.href ? (
        <a
          className="book__value book__value--link"
          data-testid={props.testid}
          href={props.href}
          target="_blank"
          rel="noreferrer"
        >
          {props.value}
        </a>
      ) : (
        <span className="book__value" data-testid={props.testid}>
          {props.value}
        </span>
      )}
    </div>
  );
}
