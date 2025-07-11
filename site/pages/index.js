import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Neighborhood</title>
        <meta name="description" content="somewhere new" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      <div>
        <p>Neighborhood has ended but join the slack for more adventures like this one! <a href="http://hackclub.com/slack">Join the slack</a></p>
      </div>
    </>
  );
}
