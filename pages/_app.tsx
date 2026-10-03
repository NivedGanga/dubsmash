import type { AppProps } from 'next/app';
import Head from 'next/head';
import '@/styles/globals.css';
import { SessionProvider } from '@/components/Common/SessionProvider';
import { Toaster } from '@/components/Common/Toaster';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Dubsmash — dub movie scenes with friends</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Team up with friends, voice movie characters and watch your dubbed scene performed by your 3D avatars." />
      </Head>
      <SessionProvider>
        <Component {...pageProps} />
        <Toaster />
      </SessionProvider>
    </>
  );
}
