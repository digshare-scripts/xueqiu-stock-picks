import {script} from '@digshare/script';

import fetch from 'node-fetch';
import {CookieJar} from 'tough-cookie';

const USER_ID = '2864763817';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.39';

const PAGE_URL = `https://xueqiu.com/u/${encodeURIComponent(USER_ID)}#/stock`;

const PROFILE_API_URL = `https://xueqiu.com/statuses/original/show.json?user_id=${encodeURIComponent(
  USER_ID,
)}`;

const STOCKS_API_URL = `https://stock.xueqiu.com/v5/stock/portfolio/stock/list.json?pid=-1&category=1&size=10000&uid=${encodeURIComponent(
  USER_ID,
)}`;

interface Payload {}

interface Storage {
  cookies: any;
  stocks: Record<string, string>;
}

export default script<Payload, Storage>(async (payload, {storage}) => {
  let storedCookies = storage.getItem('cookies');

  let cookieJar = storedCookies
    ? CookieJar.deserializeSync(storedCookies)
    : new CookieJar();

  let {headers} = await fetch(PAGE_URL, {
    headers: {
      'User-Agent': UA,
      Cookie: cookieJar.getCookieStringSync(PAGE_URL),
    },
  });

  let setCookieHeaders = headers.raw()['set-cookie'] ?? [];

  for (let setCookieHeader of setCookieHeaders) {
    cookieJar.setCookieSync(setCookieHeader, PAGE_URL);
  }

  storage.setItem('cookies', cookieJar.serializeSync());

  let apiFetchOptions = {
    headers: {
      'User-Agent': UA,
      Referer: PAGE_URL.replace(/#.*/, ''),
      Cookie: cookieJar.getCookieStringSync(STOCKS_API_URL),
    },
  };

  let {data, error_code, error_description} = await fetch(
    STOCKS_API_URL,
    apiFetchOptions,
  ).then(response => response.json());

  if (error_code !== 0) {
    console.error(error_code, error_description);
    return;
  }

  let stockDict = storage.getItem('stocks');

  let latestStocks = data.stocks as StockPick[];

  let latestStockDict = Object.fromEntries(
    latestStocks.map(stock => [stock.symbol, stock.name]),
  );

  storage.setItem('stocks', latestStockDict);

  if (!stockDict) {
    console.info(`初始化自选股票列表，共 ${latestStocks.length} 只股票`);
    return;
  }

  let {
    user: {screen_name: screenName},
  } = await fetch(PROFILE_API_URL, apiFetchOptions).then(response =>
    response.json(),
  );

  let addedStocks: StockPick[] = [];

  for (let {symbol, name} of latestStocks) {
    if (symbol in stockDict) {
      delete stockDict[symbol];
    } else {
      addedStocks.push({symbol, name});
    }
  }

  let removedStocks: StockPick[] = Object.entries(stockDict).map(
    ([symbol, name]) => {
      return {symbol, name};
    },
  );

  let updates = [
    ...addedStocks.map(stock => `+ ${stock.name} (${stock.symbol})`),
    ...removedStocks.map(stock => `- ${stock.name} (${stock.symbol})`),
  ];

  if (updates.length === 0) {
    console.info('没有发现自选股票更新');
    return;
  }

  return {
    content: `\
${screenName}的自选股票列表更新了：

${updates.join('\n')}`,
    links: [
      {
        title: `${screenName} - 雪球`,
        url: PAGE_URL,
      },
    ],
  };
});

interface StockPick {
  symbol: string;
  name: string;
}
