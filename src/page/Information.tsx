import { openPath, openUrl } from '@tauri-apps/plugin-opener';

import Wide310x150Logo from '~/assets/Wide310x150Logo.png';
import { Button } from '~/component/Button';
import { cn } from '~/lib/utils';
import { useStore } from '~/plugin/useStore';

type InformationProps = ReturnType<typeof useStore> & {};

export function Information(props: InformationProps) {
  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-12 py-8 focus:outline-none">
      {/* About Section */}
      <section className="flex flex-col items-center gap-4">
        <img
          src={Wide310x150Logo}
          alt="Clinder Logo"
          width={310}
          height={150}
          className="h-auto w-77.5"
        />
        <div className="inline-flex gap-1 text-center">
          Version
          <span className="font-semibold">{props.version}</span>
        </div>
      </section>

      {/* Links Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold capitalize">Links</h2>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            set="default"
            variant="text"
            onClick={() => openUrl('https://github.com/oktntko/clinder')}
            className={afterIcon('after:icon-[majesticons--open-line]')}
          >
            Repository
          </Button>
          <Button
            type="button"
            set="default"
            variant="text"
            onClick={() => openUrl('https://oktntko.github.io/clinder/')}
            className={afterIcon('after:icon-[majesticons--open-line]')}
          >
            Homepage
          </Button>
        </div>
      </section>

      {/* Application Data Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold capitalize">Application Data</h2>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            set="default"
            variant="text"
            onClick={() => openPath(props.realAppLocalDataDir)}
            className={cn('justify-start text-xs', afterIcon('after:icon-[proicons--folder-open]'))}
            title={props.realAppLocalDataDir}
          >
            <span className="truncate pr-4 pl-2">App Data: {props.realAppLocalDataDir}</span>
          </Button>
          <Button
            type="button"
            set="default"
            variant="text"
            onClick={() => openPath(props.realAppDataDir)}
            className={cn('justify-start text-xs', afterIcon('after:icon-[proicons--folder-open]'))}
            title={props.realAppDataDir}
          >
            <span className="truncate pr-4 pl-2">App Setting: {props.realAppDataDir}</span>
          </Button>
        </div>
      </section>

      {/* Troubleshooting Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold capitalize">Troubleshooting</h2>
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="mb-2 font-medium">If the application is not working correctly:</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>Navigate to the App Data directory above</li>
            <li>Delete the following files and folders:</li>
          </ol>
          <ul className="ml-4 list-inside list-disc space-y-1 pt-2">
            <li>
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/40">
                clinder.db
              </code>
            </li>
            <li>
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/40">
                clipboard_image
              </code>
              directory
            </li>
            <li>
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/40">
                settings.json
              </code>
            </li>
          </ul>
          <p className="mt-2 text-xs italic opacity-75">
            The application will recreate these files on next launch.
          </p>
        </div>
      </section>
    </div>
  );
}

function afterIcon(icon: string) {
  return cn(
    'relative',
    "after:content-['']",
    'after:absolute after:top-1/2 after:right-1.5 after:-translate-y-1/2',
    'after:inline-block after:size-4',
    icon,
  );
}
