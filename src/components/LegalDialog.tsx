import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Map markdown elements to the form's design language (no @tailwindcss/typography).
const mdComponents = {
  h1: () => null, // title is shown in the dialog header instead
  h2: (props: { children?: ReactNode }) => (
    <h2
      className="text-sm font-bold uppercase tracking-wide text-primary mt-7 mb-2 first:mt-0"
      {...props}
    />
  ),
  h3: (props: { children?: ReactNode }) => (
    <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5" {...props} />
  ),
  p: (props: { children?: ReactNode }) => (
    <p className="text-sm leading-relaxed text-foreground/90 mb-3" {...props} />
  ),
  ul: (props: { children?: ReactNode }) => (
    <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm leading-relaxed text-foreground/90" {...props} />
  ),
  ol: (props: { children?: ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-sm leading-relaxed text-foreground/90" {...props} />
  ),
  li: (props: { children?: ReactNode }) => <li className="leading-relaxed" {...props} />,
  a: (props: { children?: ReactNode; href?: string }) => (
    <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  strong: (props: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
};

export function LegalDialog({
  trigger,
  title,
  content,
}: {
  trigger: ReactNode;
  title: string;
  content: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="text-lg font-bold lowercase text-primary">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
