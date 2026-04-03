function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-lime-200/80">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-4xl text-white sm:text-5xl">{title}</h2>
        {description ? <p className="mt-3 text-base text-[#b7c2b2]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
