import { Button } from '@moondreamsdev/dreamer-ui/components';

export default function ErrorBoundary() {

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-6xl">🙈</span>
      <h1 className="text-2xl font-bold">Uh oh, you're not supposed to see this!</h1>
      <p className="text-muted-foreground max-w-sm">
        Something went sideways on our end. Don't worry — let's get you back somewhere safe.
      </p>
      <Button href="/">Take me home</Button>
    </div>
  );
}
