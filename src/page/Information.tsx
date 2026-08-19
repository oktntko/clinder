import { openPath, openUrl } from '@tauri-apps/plugin-opener';

import Wide310x150Logo from '~/assets/Wide310x150Logo.png';
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
        <div className="inline-flex gap-1 text-center text-sm text-gray-600 dark:text-zinc-400">
          Version
          <span className="font-semibold text-gray-900 dark:text-zinc-200">{props.version}</span>
        </div>
      </section>

      {/* Links Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Links</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openUrl('https://github.com/oktntko/clinder')}
            className="after:icon-[majesticons--open-line] relative rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors after:absolute after:top-1/2 after:right-1.5 after:inline-block after:size-4 after:-translate-y-1/2 after:content-[''] hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Repository
          </button>
          <button
            type="button"
            onClick={() => openUrl('https://oktntko.github.io/clinder/')}
            className="after:icon-[majesticons--open-line] relative rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors after:absolute after:top-1/2 after:right-1.5 after:inline-block after:size-4 after:-translate-y-1/2 after:content-[''] hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Homepage
          </button>
        </div>
      </section>

      {/* Application Data Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Application Data</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openPath(props.appLocalDataDir)}
            className="after:icon-[proicons--folder-open] relative truncate rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-xs font-medium text-gray-700 transition-colors after:absolute after:top-1/2 after:right-1.5 after:inline-block after:size-4 after:-translate-y-1/2 after:content-[''] hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title={props.appLocalDataDir}
          >
            App Data: {props.appLocalDataDir}
          </button>
          <button
            type="button"
            onClick={() => openPath(props.appDataDir)}
            className="after:icon-[proicons--folder-open] relative truncate rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-xs font-medium text-gray-700 transition-colors after:absolute after:top-1/2 after:right-1.5 after:inline-block after:size-4 after:-translate-y-1/2 after:content-[''] hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title={props.appDataDir}
          >
            App Setting: {props.appDataDir}
          </button>
        </div>
      </section>

      {/* Troubleshooting Section */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Troubleshooting</h2>
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
