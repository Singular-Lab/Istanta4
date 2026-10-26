import React from 'react';

interface RecuperoPasswordEmailProps {
    userName: string;
    resetLink: string;
    expiresIn?: string;
}

export const RecuperoPasswordEmail: React.FC<RecuperoPasswordEmailProps> = ({
    userName,
    resetLink,
    expiresIn = '24 ore'
}) => {
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Recupero Password</title>
            </head>
            <body style={{
                margin: 0,
                padding: 0,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                backgroundColor: '#f4f4f5',
                lineHeight: 1.6
            }}>
                <table
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ backgroundColor: '#f4f4f5', padding: '40px 20px' }}
                >
                    <tbody>
                        <tr>
                            <td align="center">
                                <table
                                    width="600"
                                    cellPadding={0}
                                    cellSpacing={0}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                        maxWidth: '600px'
                                    }}
                                >
                                    <tbody>
                                        {/* Header image */}
                                        <tr>
                                            <td style={{ padding: 0, textAlign: 'center' }}>
                                                <img
                                                    src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAV4AAAB1CAYAAAAGN4lbAAAACXBIWXMAAC4jAAAuIwF4pT92AABURUlEQVR4nO2dd5ycVfX/3/c+bWa2p5OEkAChdwhFRapUEQRFVFAUUcTexcrXXr5WEOzgl2JDqSogilTpvQdIIJWUzZbZKU+7vz/OM7szs7O7s5vdZMNvPq/XZjLPPOU+t3zuOeeee44yxtBAAw000MCmg97cBWiggQYa+P8NDeJtoIEGGtjEaBBvAw000MAmRoN4G2iggQY2MRrE20ADDTSwidEg3gYaaKCBTYwG8TbQQAMNbGI0iLeBBhpoYBOjQbwNNNBAA5sYDeJtoIEGGtjEaBBvAw000MAmRoN4G2iggQY2MeyJuKk65/fHAGcBCwYOKsgXnqa16YybT9qKtAuWZY37s32/SGfO4eSrXgTbkueON3J5zjtoHkfuqEinMwDEcYzWmjf+ZRWdnVlwndrXhhFkPP7z1rlYKuqvA2MMcRzz0b+v4+GVXZDyxr/cIyE2oBUnzGnhnXu1M3eKIgpDcqHDsX9aCsaAbszVr0rEMdg2H1zYznG7ttCaCnEtm7kfuh3r0fzmLt0mxSvXHM5eJx4yoc+YEOIF5gMnAAPsEUVgW3O/t+80HB2j9UQ9uoEGGmhgcmOixJce4MWKI37A/jNb7X23Nr92HOvDaiIkUUQoa/IaUlkDDTQwebFJGcqPzVTXdc9SSp0xEfdXSlT2p1f5ojo10EADDUxCbC7RcNVE3DSKItAuH//vKlBMjH23gQYaaGAj8arSyYtFnweW+NDdB667uYvTQAMNNFATrxrijaIIz0vx2cc6G6TbQAMNTGq8KlwLtFLkigUeWG7Dum7IpDd3kRpooIEGhsSrQuIt+j6xcvn8A6/ABPgGN9BAAw2MJ14VxBuGIQ8ti6Gzd/NsPGiggQYaGAW2eOKN4wjXS/P5B9eA54ojbwMNNNDAJMYWbeNVCvL5Ag8vt6ArC+nU5i5SAw000MCI2KIl3iAIcdwUn31oLThOw2+3gQYa2CKwxUq8SkEQ+Nz3soYNvdCU2XQPj2K6ixHGNBby/r+DUlDwIY4GH2+sLzRQJ7ZY4g3DiBiX8+5fDvaEvcaXgPdWHIlj0OqIXWaml1hWY1vyqxj7A3+oOCIR9n69YGbbt3ZtslBKFEZjDNnI8J/VfYBpaF4NjIgtlnh93+feJUBXH7Q2T9Si2jzKQ1sawA/4zpHb7bHzzLCQSqXXGEMEoJQiCAKabU1nY4Hv1YAWytseoFDkdVu17vONY6ZOCwJ/nZ1M+L5fpKmpmdf9Lit9pKEINTACtkgbbxRFOG6KLz22HlKpifRk6Kv4ZiRm6Z5z3T9rrR8zhlmln/L5HJ05m5e7cw1f4lcHgopvxkAc89p5rW8OQ/+q5uYmPM/DdV0sy+KBJQGE4RY6ohrY1NjiuolSUCgUuHNxUWy79qZ/hbxvHKVoRTbNkcv10VlI8earXoRiCM4Wq0g0MByUohAabVl2szFiYsjnczyx2ubjN70Aln5VmRmUUliPFjZ3MTY5rGjiNdYtjiF8P0BZKb7wYGLb3QwdPWmWglKYXC7HunyK065dKhJPekIl8AY2M4y0bbFEuo+ttPnkLUskPohtv2raXmtNwffp+9KONH3jmbHc4vvATkA00omTBAow/snTPtbTol6a6IdtUcSrlOxSu/clLRHImps2a0fv6+ujq5jitOtfkpQ+DdJ91cMg5JvL5XhitcUn//liQrrWq6rtlQKDYd3r55KZ9TxqdTjaW5yKrJFsUdhwxu5tRSv6IDCm2aZebFGmhiiK0HaKLz6wWvx2J6qjJ/a8oe7vWop8vmDW9Lq9b/nrEvBDcSWqtzxb3ABVMB4OHFGc1Os43GszIWNrCoVC9NhKm0/c9KLk1rNHYdMv9a1af5MM6VSKrCrS9/6FY7l89XiXZ1MgSlmH2ra9+0Q/Z4uSeIvFIncvUdDTN55+u9sCOwPbAFsBXQThhThOkSGsGBv6Yma2Zqx33LR2Z/xgKU2ZVF1kqpRFFPUSmTXGGIa6/yjhAbsCC5PytwAuEAJZJOj888BjwBgNdkam6PoIcxYwA/CT7xqlIvzgJbQuoPRI770NsC+wIzANmIq8TxHoBdYBS4EHgSdH+yYbBaUJYoNy2zKfuu2FebiuwXGsOidShTExQbgCxwkrK1MxxtmoHWn77ZA6b0LGdBFp+5eAxcATY7l5bAyu69J1yDyaeXost9jioEMDMOHZPbcY4g3DEMdN8+XHVoxHvN2DgeOBY5DEnG39vxSKnLj99B+cvX8r7715DWs6+wYyBisNluFd/1oBttVE3r+JdMrHmPrqMYw0jvXnXx661fuUCSsSfiqliOMYt74svjOAw4G3AIsQshuuUkKEgB8C/gT8mzolEsu2sYM8799xCr98aDm0jOi6dx7wfgZsewo/KOA5u//+mNkr2zOKY/++Brpz5YuQuwJHA28HtkcIZSTkgWXA1cC1wH/reZ8xQylwbX74dCc/fLZzL2zrEVBgTH3Tp0ERhPn37Tpj+xN3y4R2me95FEVExuLE65aJ9mQN2wd2BI4A3gzsBgOeNUMgD6xA2vxvwD+o9tgYBrZt0xsW6PvCjjR969l6L2tgBGwRxKuU+EretdQST4axxdt1gPcgaef3r3lGGEFTqvczh0+5Jp/ru7tZK7OmnGRU8k8hAOMrbLt1VFKr7/PmHWbsPb+jeKDrNq+hLCFoHMfERpMNwuEWDBcCHwFOA6aP4sk2sHXydyKwHvgz8BNGsGUppXBdh1P2SvPLp1PgByN5bbQBA0EzxGST+cWhc05ts3sva820r0dcAgBeB3wcOGUU71JCGtgB+FzydxfwU2RimRgoJcQYxxaO3TGqa8UVse2di9pODv2+v7gOudJPoQrAykA87IR2KHAucDKj8xROI5PZ9siE+Czwe+ACoHOki5VS2LZN5xHbkPnWYtS42Jwa2CJsvL4fEOPx1YdWj9VH9hjgbuAXDEW6AHHMjCavRcGJnuedVDRQUy+2LSGf0ZCuAZTC0Wofz3X/C3y4/OdiscBjKyKeXNklUdYqkQa+h0isH2F0pFsLU4FzgIeBHzKChOm6DjYFPrrHTPD9kTxJKs0ZsYG0x5wO60faso6+8fE8rO+Zjuv8GriDsZFuLbwW+CMi0Q3dxhsLS4/NXdAAtkUhMP/nuu4bHMfBcRzcRJu67L4u6MvXkna3Ay4DbgXeysZvz9gROB8xPb2/ngtc1yFLkdz5O2/ko0cHfWAr6fP3peXSo2m/6W1MuftMptzzHtpvehvNvzwC71O7orbZMrdpbxESbxiG3LMEiUDW2jKaxSmNzOznDnuWMUIQxrDGD5P/mlc2rtR1lQ2Q0Jae5/Gxh9bUGtQHAr9C1MqhUZIiq02HKNBDEmUK+ASitn4AuHmoW1uW5rhdPH76REo0g+HV4UE3yLgK22p65euPLd8H170Gkb6HRmwG2rn0qVSSxHRYO/Exyd+XgG/WX8hNiv5GzucL5EOPS59dCalBE+5ZwI8Qu/3QMIhEXd32w9fTHEQQOQ14N2K2qX37pP3XHTyb9Nzn0MvrtlSMCe7Z29Ny7mE4C2egmoY3K8bn5SjcuZje79xCfE/PhJZrPDHpJd4oirCcNF95ZO1od6ltB9zLcKQbGygUk6AnBlC49RBKoQi5wuj+8gXI51mZCzAyQkIY2BBy39II1nQN2JMF7wZuYzjSjWLIF6GYvINKiFZrGYhhKM8OhnUHmg/chFKfH+oEz/OwyfPRXWdAsThyHZVDa5Qy5t/P+J8gm78d2xqadIOkvFEk7+BYkHLAc2SzjEGk7nxR3n1ofAOx/45fAj6lpHyjbfuctD25vHQzY/p9W40xXPV4n5hwKrW5bwO/ZjjSDSOpK9/v16jQySaO2CT1VJDzhoLhMDAPo9RJwy3weZ5HnymQO3uHOitr9LDfNIsp95/F1F+egbvX3BFJF0BPzZA5cU9m/OdjpL+234SVbbwxqSXeEind85IlfruZuuPtzkYWEnas+WsQSmd0LA6c28Gi6Sm2neoxJWPRkrZQxFiW1TzoOiP/HL/tNKZ6qj9ISj2IAROE7D6nGa0HBlgURfiRw3n3vyKDZgAfBC6qeTNj5B2iGFIuRy6Ywh5TU8xP3sG1FbGB3kLMqm6fZ9f7XLEqK3EtQFzxak4w5ttoPc211KerrQnGgOt6HL+7I1JvFNcn9SoFluL/7utWlzyz/viaC6OxgSCQh7Q3cfpWTewxM8XWU13a0hrHVhgDed/QmQ15bk2RB14p8M+VvUIsjj1UoKSTgOuBkzDkN8qLxABRxJwpTRwxzRtV2wOEBjxbkXIUOiHYIAjIBikufTpZMB4QKn6NSLuDESdtH8fQkuGkBR3sMtVjXodDa9rG1hDGhp58zEudPk+tL3LtqixkEzOGbVdqQAowaiqYq7H0WZ6lflvz9ZP27z54Ls0T4EyS+uzutH/tJJRX2Y4mHxA8+wpRZx8mV0Q1pbCmNePuPrviPOXZtH/5BHR7hr6P3j7u5RtvTGri9f0Ay0nz5YeXS8esb5faDGSFe7DzdmxEWmtK8/E9pnPwwmZmtErAHa1BqxgZT7oPWD5IQzcxxIaPv34KQb4bzxutfcnDtjSOY2MMM0qB3PuCDMW13eVmlPcwFOlGsUgy7c18fbcO9pyXoi0dE4YhlmVQRKV6ym7VaoLtpmnrddulmt+rW/VL6yKufLybW17qFHnbdStVUQME0acWZ8MO19ZnyXQxcIJlWdhBjo/uNp2f3vtSfcGJLA2FkEueWiu28WqvjWQS3HWrds7dq4MdZ9lo4yfPi1HK9AFdQN6zDO0pk5rXYbUfs2tb84dyHdyxuI8fPL1B7KOeV8uschRwA1od0W+KGRMBG/ADztxuJq+d5+ONMQRkyjFoLZN6Pp/n3hctyOWhrbVUlxczFOkmdbXX7Hbeu2s7O2zlkLIDoihOXIlDUCrCmL7ZbSbcYYblHa2bms4J2nhqZcAvn+zi2dVdQr7lJi2FNHUh+M2aQuR5DhfXerxlWfQEBdrO35nm88fPvaz1jyfQdGqltBpvyJO9/G7ylz1MfH/v4LIcNY3mjxxC5o17VN7rI0dQvP0FwqtWjFv5JgKTlnhNYrP89zMF8dutz5PBRlbrB5NuIiWcutNMTt+7ldZ0CIQoZZNOp1cB1wGPKsXTQRCuNsasJDbn13pIT94wNZMuuq53ATBqw5IRi8A9YRhhWRZ3LO4pl3gOQCSewSgGYFt8/oC5HLFzBgsfS0dYlo3jOM8iC0tPAk8Da4GCI94c08Mw3GH+lGjnrxzRfuw7Xmnd8/v3ruPpNT2VZKVlo8Rjr/S897HlzdEhC633O86AhKqUwrYsjtnZFal3ZA+HATg1tncXipBJ8b+HzOWAbR2CIMC2Ymw79QLwV+ARZAFwBQP13OzA7DiO92xPB3u/cXfvpEMWzt35sod6+PNza4TcB0u/h6PU7zDm3QSBTF6lohgj57t1bMhR0OvHpDOZlz3Pq91G9eH+YrGIk8pw2/KKQE8fRhY9ByNfhNY0Pz1wFvvMtwmCAK0jbNvFddU9wD8Rj4XnEG8FH8gYY2Yqgl32mad2/812M4+/87m2bT7/4FrozUO6bPLQCsKYK1/ccNExC1vYuiO82PMq1/FK7b/+NbNpmr4YtXbUu9lqw61sr8JdL9D9wauIH88NcQFEN6+j++a/EHx/FW2fPrrit/ZvvZl1V104PmWbIExa4lVKEcUxv36hdzTxGL4NvH7Q0WIAWvOjw+ex9zwFhLiuB0JSP0DU0XWyJTkiCHyufzJiWWefGoZY8sBnRvla/YiimCAI+OvjIRc+sKK0IcRFXH0qxUKDSOotGS47fBaz20IcO8a2UyD+mT8C/oM4zdfCC7Zt32PbNnEcnz9/anjQz0+c9ZFf3Zk++fJn1lSaHrSCSPHVe1edffWcBWvb0/4XyyV7z/MIoz4+secsfnT/ciG6kdpH9f8zgHyBraa3cuHhM2hP+RJHPJV6FPguYiYaakLLAs9prZ9zXe/PwDe08o859zWZzy6avc0Bn71juUwI5bZyWXx6F451987tqV9sk7YpJubhjAX/7Qno7K7pUTAUFgNfr/fkckgA/xCD5n9uWsddyzdI2xuzJ+LeV4nYQKHAodtM49MHTyFt+4BV0rYuAX4J3McQewuVUs86rns7QBxHX1y0jTn22tlzPvHlW9cuemxVl+y4LLWfbUEx4FN3rr7oqpNmrw2C4CrHqVhzwPM8smGW7Ed2pOUr42Ny6Hnz1QTfWknbx99A7rpH6DnthrqvzX3mbrwDtyf1uu36jzkLp2O/aRbhdZN389ykXVzz/SLLu2xWd2Xr3TCxL/DpwTcKwLO58sT57DEnxrYdPM/zkdX83ZDOu06pxN7qF7n60YAf3/vyYHtYJTQwdyzvppWiUMjzj2diLrxniUjz8pgfUB0DFqBQZK+Zrdx88hxmtwWkUils214CvBFxpr+BoUm38tlaF1Op1H+IwlPOfk3zEZ/bf+5DRFGlD6ljgR9w3u1rv6At+4NxWbaF2Bgsy+LonZuSI2PQ2/MFDpk3lStOmEVHOiSdzhS1tj4N7IVMPKPRInKu5/7VcewD950Xf+jS4+Z3oXXlYqICwhiC6Oef3m/a7ucd2sr/vGEa//OGaXzq4GbO2b4VcrnRTPBjciQHmXDjOOK8f3Vz+0vrpe1F2r2EQROugaLP23fZiq8d3UGzF5JOp9HaugnYBwnSfw91bujW2upKpzO/b3GD/S9844z3Hb3ttB6Cqk10nsPatd1c9kD2z8bEe5sqLSA2Btu26XntmLr+kMh/4V7WHPrTUZFuCX2X3DnomHfY9uNRrAnDpCTeklSwLhtBb67evfA/GnQkEHvnZcfOY2azTyqVRmv9nDG8Dvhx+alxbIiimOuejLjwweUihQxNumOGUpDL5ynGKb7/yGpRM+U5uyILapUoFKG9iW8fNRNHBWQyGZRSNyCbD/421nI4rotl6X8fuXPm8BMXTPkHUVSpaqc8nlnZxb0vBj/2/aBiKduybEwcsuesdlkUGw0KRZqmtvClw6egTEA6nVoCHIJMOmOCMaC1RSqVvmjrjuDQi98w7ymg0uvB0lAocvPzvb+1HUcFkSGMRILbcYYLrU3iATLByOfzLNtgc8/L68u3vb8N2LvypYB8kRO2n8YHX9uMiU1Jyv0u4i738FjL4HkeCvObsxdNOXSX6c3PDnpv1+PXT7zC+pxzZRD4gyYZy7Lx4xD/xKljLUJNxPeNzR0suHsVcW+lp401f2Nd3ScWk5J449hgWTbrsmG9wXCOQrYBD8AYCAP+99B5zG4pkkqlUEo9CBwE3F9+qlLQl81y31LDT+5eCpnMuIebVErs1j09PRQih+OvWyE74AY2S5xHtXN8KO9/9TGzcVWRVMrDGH4LnACs3JjyGGNQSuPZqvv12zQfR8a7u0LqVQoszWcfXOtqy/u/sGxw2raFFec5ZfsWWeirF0EInsvvj5mNRUAq5S02htcgbn8bDaUUnuc9utPM+MBzdp/5lHhKlJ3gOPzx+c79Xuk279fGx3Pkx607IjJNic16AlDSpnp6eljZ43LGNc+L69jAxH7+oIt8n+nTWvj0YVOI4wjXdTCGTwJDuvyNBlpr2jL64RO2aTkC2+quCNJjWxCE/PaBrp20tr4bVwXwsW2LvrhA7vBtxqMoGw3zTB5TRbxqAoSm8cSkJN4oioiUx7ceWVtrF1ctfKLimwGKPofNn8qieckMr9RSRFKo2CZZ8iwIVIbP3L9KQjuOc6OVbMdRFHHX84bjrlsBPTlxj5NJZQ4SRm8AsYEg4luvmUOrVyCVSmEM1zDUiveoyxMSBgFX3t/DpU92gjGnYenuihNdB7r6eOTl4IA4jt5TOmwMWLZFEJn6dxLGBsKQ7xw0mya7QCqVWm0Mb2Cco1hprXEcu/dt+7Qcv9PM1rUVErklJohbnsl+UyvVoZSSYN+WxZd3bQc9/qEdlZLgTqGxuOEpw7tvWp7Efei3nZ6CxK0dQBSDUvzsiNlEQRHX9TCGz1JLqxslSmauyGguvm0tf17auwJLv4tq97iUy99e7mJt1vpIFIYV5Su1vwomx/ZhtX1qkM+vyY9CINgMmJTEC4nl0Nb1DIR5SMCYAcQxOA4fPnBaySYZA+9AIlsNPEOJy1oxcjjn76ugO18v0Y8KhUIR3/e54v4+vnbny5Atltv2QHaOVa5iBAEzprfy+h1dXNdDKbUYOGNjy6IU+EUfbVk88nLMz59cw+Ov9IAfLUMWJythaf74bDe2bX/JGNPfXzzP44hdmmBK80ibM/rfp3laK6/Z3sEVm/2ZSPSsjYZSEuvC94vJX0AU9C09cV7Lp4BK+7Wlueil3qlGu+8t2a7jOGaveeM74ZY0nFwuR2Q0X/rbKi6872UpS2UI0bdUXGgAP+AtC6cxvckvmReuQQKLb3SZ8oUC+dDhxoe6+OviNbzYmYPIXIfiHxUnaw1+wO2Ls0Rx/JXqe3meR/f+Mwn324TZvYeAc/BW6LZKH//g+YneeLpxmJTEq5Qi7Zl6B8LJVO9O8n1O3W4K0zIBjuNgDN+lRvQqY6BYKPCPp/MsW90JTelxl3jy+RxLOy3O+/t6fvHYaonuNdh16W2VBQPimK/uNw2/WMQSqfLd1LmANhyiKKIQGB5dGvCxvz8namWq36Xsx0Blj7Us/vtKlnVZa9swDPulcqU0jmVoseqaHMEYvrbXVMLAx7KsS4GbNvZdSujt6aUQWnznxvV8+z+9fPf2LN+/M8+FL/Zchuc8WWE2sm3oyrJ4dXiu7weOvAv0Fc24tn0UxRQKee58PuYdf13JXau6oa1FpO6B53QAx1VcGMummHft055sRFNrEb/ucShTRLYQ87cn8nzrjiXSF22rtD46iFzRip8s7cWyvdOiKKpYrVJKE1lg3M2v0ntH7Vp5IIwpXje5I6lNSuKNopCHlwaysDRymMQjK77FBrTm2B1aiOIYrfVq4FvVF4mJIccLG1L89OFVo40BURfEM8PlPTcs4b41vZWuOwOYhazmDyAMoa2J3eY6JdK9mo0Me1iyM+b6cjzwUsyH//G8OO1XlqeI+EEPwNJQLPL0qgJhGJaZG8RG3FsYNppa8j4RNKfZa5sUltZZJI7CuCDwfV7pc/n1bWu48eVObnpxff9fX3ceUBdXOF5oBXHMU6sL22qtjqxetR8vRGHIHS/AV+94mVd6CkP5oe8PtFYcCUOOmdNKR1OMbdsYw7eRDSRjRsm0VCz6/PL+HBc/shKmtFf39weo7mOOmJrW9qLCMHxn+U/GGLTWWC9vXpVebZsic2xl3PLCf18c80LdpsIkJd6Iq5/pkRgKw0u9DuINMIAwhNYM86dZpchPF1NDUpStujZfvucViQswzotpge/T5zu8+4YlcmDowO2LgMrtyWHIO+a0EAUFkritgyaO0aBkUgkiw6/uKfDF+xNvitr4y6CLDTy1poBtWYfEcTxHDiviOOL4mU0jhTOEIOCUrZqxTBHLti9HNkRs1PvEcUxfXx9XPJDjjKuX8IfFa2XyTHsDf7YFsbmB6rxfts1Da/M4rvcWY2Icx6XN83nXTtMl5sVGIp/P8/xazfm3viD1PHR2ktcMOhJFHLmgOdlNab2C+OluZHkK9Pk25920geuX9wxnTqsMqakVRBFL1xVRqlIyV0oRRRHFo2dubPE2Cm0XnzjIzNDz9X8McfbkwaQkXlDMytgMMvgPxgIk68IA4phjp6bRxkdrywd+V+vCYtFnRbdm3druscb3HRYGQ3fOiOo4/K6oyngSsSxY7bOVdCal1O2INDImlFzzwlC0iD8/tQoiM9yOsweoXvCyLZ7u9rFd1zPGvC4pF8VikTP36ZCJaygk2/T2mpkijEK01peN9V1K7+P7AVEUsazT5pdPr5MFvqHy7yleQrJVDEBrbusq4AccFMdGa63ARMxosod/l/pLyUudvmhrw2/KqBQaohhSKRZMc7Dkut8BfWMuhZJ4EEFkuOK+9dz30rpkZWzIMt016IjWvLDex7LsRcaY/hxApfbvfvNOgy7ZVPA+uhPpo3apONZ39cNE/1w3xBWTB5OUeOvGXCT1jSCJ0LRzR39ch0cYZgGnNaUmZCVb1DCLnz0wYpxpqN6EkWxhndPulswMY7aFlhbSotjwvduyfOqOFbXsjNXIUp1SR2seyPoUfDDG7Dtwf0XeN8PvoYgNOA6z5X1eYiMnkWKxSBgrvnzjOt7796VglIRTHL4NKwMLKAXFiL6C2d4YM1/8gBWF0Gy05hOGIUZ7fO3x9cNpFSVURmmLImhy6WjSWJYN8PexlqPkrZP1Lc69YS2Xv9glbT+86W4Zg8waihe6fZRCIZuUyp6h0IWJ932uBevgdtq/cXLFsWhVD72fvXGzlGe02NKJt6nyqwyc6S39Eub9tS4CcTtavqEO++RGYMNw4fgG0DboiK1pzYirE7IddNQokS5K8e1bNnDTC2tkkqnvfStjs2oFhYBCYDDGjE7ESSSs1rRGKf0AA7nYRoWSpKu0zVduWsvtL3dKnAmnromzcsFQASamzzcOxswfS3mGL6wWu/bIdV3Zf41hR8/Csw1KqfVIsPLRP15BLpcjHzocf81yXujsq7ft11LtH65gcS5EKY0xZviY0JsKGYspl5+JbqkMVNR59mWY58eYVnATY0sn3po2gpTd38FqprWJ4xjPS/HJB9aOpArW7Kn1UnWmvvxple+QqOauuMf2IHEBRo2+vj5iZXH+LV3cvGStqOL1u0tV2cQVxEbSixmzgNHG+NAKz1YopcaUdBHEJg/wsRvXc9eyTnmf+ufMmup6EBkYOiB7zbvX1aIiQo80ITiUa2vJdS2WJo5jlFLPAxvqeVwJJdt3b2+WrC+kS29O1hfqq6sIGBSZ5uXIlISA7QZdsRkw9b6zsed1VBzr/u4/CP+2ZjOVaPSYtEFy6kTN2Hye3Z8Sd0hnPjO8rauEmtLZSGtJo0SNuxliGSldQN29STwXYsIwYEWXxZWPdXJriXRHh5r9IhGYpiOTxeBYfSNj1Riu6TcxLOtO8ciyTmga9fvUVD2SeWjKENf4SAyEik4Sj59ZylCj7aMBa8eoDJUlW75SiiWdDh+4J4lANnoXyUGDYuoAaW/2fbgdt52Ou2vlsk72D/eT+/w9m6lEY8OWTryV0x4KlCLtaJKxNnRcueT0EVAp+SkNkU8QGoypPXDK8UC+ri2oldJYkj2g4BtSlvEZRarpku/oA8ssPv/PF8RndWhviuFQWa/GgGdjawNKeYwh71dSUWPyQ/aLPmuzDmdeu1gWKkdvHRruCmeI4zmEfEurnGCguxhjhvFBM8ZglJKIeMOr9iHV+emUZk0QoZSFMXFe1WkGG4iqF3DZ/QUufWSZbHsfPemmqc6/Z2Bh2ibZNlx3JoKJwJS7z8Q7qDKGVO7aR+l9++gD62xuTDpTQ8nfNOP0S63DYdvKr3J+S0qV0usMSbxKKSiOaOMdbBuMDZ25CKVwGKb+jDGcv3PHQAqeobF+0JHI0NkXkaSNH4oYKhDHCem+rPn8v5fI1ud0TYVgJCiqVcooYr9Wj6aUQmsdMIQEWQfG1N/CKKIrj+yQG0uiyeERg7RXVyGiLGbBGqr7j4IVuQDLsuyhuNeyNNr4vGXbKfUE3emq+KYVKwoh2QLEcVxXu5ck3SgKueLBIpc+vlLc6hx7LIvGsxgUcc+w51Qv8dtWm8lpV9Nx2xmDSLdw+2K6T/rr5inSRmLSEW8UxcQ4vLihUE8cgEUV32IDnkNzWiOLsLXV4ZIP4vEzRkypvWTwxfDiOh+ldMYYU1OcVEphTMxrtq8rwlml14XWEAQsWecTRlGTUtVS/WCEYUihkOfB5ZaQruvWG9GtFmZR7eYE2FqVXmU11ZLaBEMphWsp6Q8TtOFBa4vdZqbEx1WesYrq9OeWxS1dPmh3SjSE25llWcShzzEL69pKvbTyYg19Bdb1RoRhOHjRtQaKxSJhGPK7+wr89tEVYoYZ+4LxQmrkqNNKYQbqZNNiis3Ux99P6vWVYR7ztz7LhkMu3+TFGS9MOuL1fZ81WZt/LV0njudDYzuqiTeM2Ls9RbNnsGwrxxARvLRWFIt5PnjQ1JH8Np9DdnOVX8yflmWxHQdj4gW1LxP0FUwdQjuPV3xLpOr/rMhh2/bUKIq3rX2ZwBhDrhBx30uaz/1riaz0j510QXYCVi74ac09vT553xDH8VPAxKaZ3QxwXZeDd/CgNVOeHLKybWwbuvtY0RnOjKJoznD3q3N6GORfTBjy1KoCSqltjTFDqvbGGIwxFAKLS+4vcMmjy0eziDYUjhl8SLG4q4iWWffxwb9PHPTezUx/6MO4u1XadPP/eoauw6/clEUZd0wq4u03M6R0Pf61p1Kthkchi6al8P0iWlvLGGKBIo4NjuNy89PZkSTSpVT7gFoWy9b3sWJ9TBCE+w//HnWNgsEbFlyH21f1kA9dHYbB7rUuUkp2xxWLRb5+WzdfuHWJSGsbR7pQHSUNhBByPj15A8bUpQJveTCEsa7WgG6rOCWZFP+7NNeqldqj2txQUvu11ty1tK+ethgcwdtxuPzFHjzPmxfH8ZDRvHO5HLFRHHPNSi576pWEdDeKdR0k7kklFNzUVSTGwhgz/hGkhoB1aAfTrn8/9jaVCl/fVQ/RdeTvN1UxJgyThnhLfqdeKs3P7nilHo+Dsyu+RTHYNou2biq5vjzECD6jbV5dr1+ZsjQxBVz7VA/A0dWxSrVS5HI5bMtmyapCPYMhj6TtGYCloejz72eyGFMVeS1BEIT0FhV3Px9x18pucdavN0Tj0FgAHD/oqFIQRjy9skhszA6JM/2rDioh1jLcMugk2+KCZzcQ4B0WBH6/5BnHEb29WcIwZFW3w6XPrqsnc8oTwPMVRyyLl9ZleXJ5iO/7hw7O9pw8q2jz27u6JHtw/Ylgh8PbgcEBdi0LsgVWdMaEYWVA/ImC8855TP/7h7DmVFpbslfcS89br90URZhwTBriDcMIoxRn3rCWW5d1VubMGoyPUJ0iJ46hLcOOs20cWYAZMqiMUoowDNl9Tqoe37D/q7wY8DyuWNzJhrx7QBAEuyglhBuGId093Ty3RvPFv63lnJuWlkd/Gg6DjVWOw/ceW4MfeycEvj+zelz5fsgP7+7mS7e+KIOj/nxhw+E71CptsuHgjy/0YlnWDnEsmw6MMfiRqXezwKSHMciGjAE8SfUGFtuGbJ6/PtzzNq0tByAMAsLY4tonQn50Zx+nX/sCWMOmjSqhiARAGoBWYAzfvn8truueGVZtwoljQ2QsTr5xDZc8vlK0nI0PZ+kwVOAiraEYcN9LOeLY7FUu5Rtj0OH42txTn9uDqb95NypdOf57f3MnvaePeSPfpMOkId58Ps/iNZoXV47opzkb+Nqgo0HAeTt0EIdFtLYMtaSVMtS13VXwINUqoVYQBHztjjWWZVnnBEFIGIV05S1efEXxsfs7uXPFBvEsqA//pjpwjG1Bvsgv79nQFBvzgSiKUAoKhQK+X+QL/+7h38u7xUd3fEj3WGqZGUpwHB5d3cParOX6vn+IFNGiIw20b5q0ORMJrS2iIM9P9p1WvSh2ScWJCnBtLnp63bynVvG+51ZFPLYCbng0y88eWsn1zydrE/Vz4eBJ13V58ZVu/vtCuK/vFw8rHc5mswSR4pA/vgx+lOTqG5cJ7yvIwtpgKMB1+NHiLrSd2iEMw36p17YsCi0W0T7jE+uk6ccH0/GdU1DegOeKyQd0fvKPZN/3z3F5xmTBpPDjzedzvNztcfb1zyeRk4adRf9Mta9hEEImxeE7pVGy7nM71bbZjcPXqY6Z4Hk8sryTax9r/tAbd7V/3tPT99Q9yzy+ddOzMLVjtGEm80jOsR9WP+Mvz65hv9nzP7f/vOJFtu2su+GJgKdW93HfmsTTqb7dcSNhLnDFsGdYGnyfX93fyXmHtr49juNLPc+jxe/lPdtO4ZJHlo/VZ3jSwJgYz7EhDEClRRtS/Bb4HMbM7yc5y4Iw4pw7V/0YrW5gfc8yLGus7/8Y8EfKYzIrwHb47O3L+NPJ2323I+7b30s188v7iizNZqGvOFIi1tHgDYwUptOyoCvLLU/lnMMWqlMcx/k2gOu5dBV76Th0Nk0PvbBRhWj9wxtpetuiQcfz/36G6Nl1pL+5PyrljGr3kvIciv98hvD6yRcUfbMSbylC/8tdLu/721IZ3Paw/od/pDqUngGCkM8vmo1FEcdNAfx0nIt6M3AH5XndEpPDDx5Yqadltr584fSmfR9fmzW0t4q0OhzpxrHYpCujlv0C+BjldjatwLE47/aXM78+dv7F89qLb/3dS72sX7ZWYumOj6Q7DfgHtTZNxFW7+zyPG5es58Sd2o/YYVphN53OPGFZFjk/qCeS3KSH47jMbIEZ09tY0+eX+qKPpb9BzK8lCFNysm1BIXBx7L/QnDma2Ixqe28VvkZ1MPwk0/OpNy5bdP0Jcz6f0fF3rnpxgyQXHb9oegdQHQoSEnIzA5N6MhF846HVvHb7bT+gi8UfpVJeIY6NpACqb6PQkGi96kSaTtmn5m/pI3cmc3zN9eW60GOpSUm8m220lNTml7tczrr+RSEZb8goUx4ikQ1WhYtFrOltHLNLqhS79mlgIryqB2cAtiTs33l3rdj7Fw9kL79+bX5kB39jIOVAcwpyFYtvOeCjg863bVCK9/1rxVuueSL63/WREWl6fKSdOQjpDg5+UpIsyjP1agVa88H/LLd8kzq/p6eHNVmXP76wXiKEbeFwHYdmp8iC1jTkC2K7jmIIo9+g9SNULaRKMJx4EYZ/oNS0jXj0U8BPahQIsgVOvPGVb19xX++puHY9Ec/qxaHAvxi0Uy3JxGGoHIuOBYWAL/xrzTaO43yop6eH254p8v6rV/PEXlsT1etAVwPeAUOHgCg3O4wJk3TtYbMQr1KKXC7P+pzLWdc9LwQ2dMzawxB17B2DfglCsCz+cPgMTByUiPczE1TsJykRY3kxbYn69M8V3e/AmP+g9S7DSrthzBzP5p8nzea1czugL1feOa4DfjXoGseGMOKiJ9d9ijD+LZYedbCCGngLkiJ8v4qjSkG+yCFbtfLro+clvnFlhOPYkCvwtr+vPsVx0+/MeJYEDxeCmrQdvR7ExuA6Du/box1am2WCTLvg2py6dctZNHmV9l9FSQI+APFxHdpGPjI+BTwyiL88l7irj4ueWvdHLP2ZcZpwPwncyqDoaEC+wKf3msGPD50rWZfLy5P2eHjFBn5wa9c3gB3D2PDCy2tZOaeF7Bcrw0qPBuHSdcTdhYn56xo+asDmwmYxNcRxhNaa3z7UncQBqCnp7gKcg3gwDEYUQxjy/SMWMK0pLCUF/CPwtwks+gUodQCYd5aiiAEyccQG/OgQNP8F9R1kUWZwBl0FK/IBKcdw/hEdvPtvISsrg7F/DMWBxOxeOh8oZVOAIHoPEhf1u8BYvMj3AT7OUIkzC0VIu3zqdVNJqT7O3WUqFz26GqwyiTbl0bO+lx/ckfrVgXPSyzHcttP0Fp4pBGJ/3Hi3ts0Gy7bZebbhl4fPIY4NllYYA80p9dBeM1Nf/cLdK/9niK3Ls5D+dzJi6rp7lI+OgLej1YPEJlOxOOcmts0w/h4iiPwvsiA7WrwB+AIi7Q5GPs+uW3Vw4p4Z4ihkn1ltPPRKT6WHUcrl6sVrUvPb5l5TjILD0dYqpaDztbNpZTFqDJLvhqOvQDVNjAxo1o5HYPvxx2aReIMgZE3W5cYl6ySYh5BuBsnGcBqSVfUhhiLdMIKizxdfM499tzY4jgPiFfDeestgTEwxQlbj65XSRP06HUv/i9hUGvq1StyuaEVS9TwGXIb4xW5L+VbMYkhobIh9rnjTTHae0TYg+RryoI7DUsuJ40qJQ6vS9z0Q08vjyMLIHlSnD6rEAuCtwLXIho3apFv0wbK47Jh5NDuSZPPwHZr/ADxIVDWgUh5/X7o+/ZXbX7r1B0cu2OuCN7RyzjatEIRbrsiLxGkGxTZTbaY2W0xrtpjeauHaFou2TX/tp4dvfSNRNNx24LchmRxuRcxTu1Kynysl1/XlKv9KmoLhGRQnoqnUMqC87Y9FTAS3I/19R4YWoFwkdfw5yERwM7VIN5F06Wjmh0fPII5CgjDgLTu0XUwUra0QipSClMePHlyx00XPdN592Rl7pnZIheTdiPzH5g9dscMhF2HWBhPyl4TimHTYLBKvMYZLHlwPUWyh+DmwAzAD6STDww8gjvna6+fx+oUWtm1jWbrPGN7MSNHIyuC6HrPbDLts1cFTnbmR/IYFCohidmhLnTjVSV3/35Xdh6H1UDuUpgOnJ38+8Cywnii688N7zvoysU8mk8H3fX5y3Aw+f6PhoXU5STAYRctntaUPzcbmP9nO7FyJyKUGyjCA3ZK/ryPbmxcjwV3yyKQ6FYk3uzdDhNDsR6EIKZcrjpvH7NYQ1/Xwff++XNG8HWN2wVKPYYxVMUk5NgSBmjcj9adCvvPtR+885cGfP/6KqdAGtkBorWnyYppTlXKJMTG7zzanXnj0gv9++Nblu1L0h8tfdigDJPcSsAw/6FkwtemMc3eZ3anKvFE+/dA6yBZFc4rMLbt1pE9+oi/4K9kCeGX9srJKD2ZgsfcR4EUktkQRaeupwPbA8CtTxkC+wE6z2vnBUbNwtY/jeoRReFFPIfoQcC9aXSoeHqU+qJKFR+Yv2Mq9LigW3q6Vs77r2O3J/GRweJMGBmOzLa6lLA0KG7Hdvp6RSDeOZTHKsbngqAUcvL2QrtZWZAxvZZhsE7Vg2xauKrBoZrO4D40CS8K47+07tx3zlQPn/BtjhLSGdx1zgd0pFA89eHbbaSfv6bqOrdFakUp5WAR8+9gkHrcRKTc2vPDd/aYd95aF09dQKNYTcGUHRLp+D3AuIuW8FTiQ4Ug3iiGXp2lKM384fh5btQS4rotS6gVjzInF0EAcP4WlT0dRHsdABqDS9BWihY7j3BobYzHKOLKTFVprlFIVf1prXNft3XUr88bLjpu3hJY05PKDpdPB2IbYvA447keHz1q426yAveca9p4bs8u0PD8/aCYUCv329Llp++qfvXbmyQtmtNR7/70QE8f7gA8ln29mJNINQsgXeON20/jpsTNpcvySye4a4EM5PwZjfofWP8VQWQ6lQEM2b96gtb7aYLSq1ooaGBKb1asBUXIG20HLYYyowEWfNy+czt/fug27bhXjOA5aW71IUJdRpxWV1GY2WT8atStUEBn8CP+wHawjrjxxwRW7z2wVVc0fgcCNIePa85RST1qW9fXSAnIqlcIhx7t2niEDTSnW+BHNnn78I69r3uubr5/3ELZd7yCsD3EyYUQRH9prK244aStmNAekUimUUvciduTV/Ws5YfSHRVObzsS1pT0Gj7EWY3DZxJHLNjWUUniet3ROW7jolpNn33327rMk0FK+MLKPqaVJOfwlk04fk06nSacztLa1sv10w5wZ7XIPpViWj9hmqnP1b4+ffvSH9toqW/f960Uy2eLa/M/B2/CZQ9vwtGg5wG8Q0pZ1PPFw+NgBM5ouAIYSAPamzvClDQgmp/OlMclsLJLefjNb+dnRC/jkYe1kHCEHrfU9iKr1n01ePgXFIMZxXWY2+6f/7ISZn/32YfNpbUsLKRWKIhkOGieKMDauVmp7Y9i5dFRrkajeumeLqK5hCAq68zFa61UHLuCIq0/a+tp377aVqJv5ogTaHu1ANMjkkBfCPXqbKVx2wnxO3TeDJiItO+0uB44GuiuujWJ2anN/d9lRc89aOL0V8skkoAY9YXL2qXFGOp1a7+j46NP3b7ry/944n+MXTBWtrFBMzGE12sZAEDGHsjjSlmWhCPnSATP7XbksBd25GGXCm9+6b/p1l58w/4Gjt5ki9Z2MiVGHx4yN9JmCBNt7566zuOZNW/P6hRbasnDFZPJVRFquRBBy9Lzmj158xNwfk3JkEjDlTs10U3dAtgZg4my8DtBCFA8Elg5DVoc1pTU5L4qkMUuDubWJk2Y1ccIOLeww2ybwixKX1fUiJKbAV9iMlvOSuUtUM/P9A+arB67dbs73Hn+5uN9fnuvltrV90FeQd9FJvIYwpDvoL3I/sYnU6xHHed6z6ywueehlIC3ZwS2LVCrdZVvBSWfun/7wm/eY//Wbnupt//3yLF2d2f508LK4V8OuWhKrS+EvWzK8bU4Lb9yphW2mSRQ123FRSq01hq8APx/qnZf1BWw7Q//2NyfM6P39fakrL35irU2+QGwoxWuNUSolC4/J8yJZONrMSxwecVkdJKS1MQKkMeA4TtYY886tp/g3f+6Ijm+d3jVl9k3P9HLpiix05+R5Wg9sREjSllCWdcQY6UO7zYHpszpYu3oDliqZUW1APTqnIzjoS0dN/c4Z66d+6ponu7lqZVZyqYG0vRqm7WMDkbhdZtqbOHNeC2/YuYWOtI8iwhEp9ylj+Dgw5L7c3mLMYbPMJ645YW73xfd0fvWm59eOpH1NHUV1ThqomAmL+VyOiSLeXoLwJbRO0+R1oJTGsdijeUAbWZVPVJYgXIJt612mptv3bEtZ23W4bDvdY+upFq4KMMRgYlKpVB4JWHMhEtVp0kBri1TKujUMw0W7z1Vn7Dmv/RO9xal7r9gQ8fzaIs93+TzR47O4J8+CZqfmIDFGshe8dY8mLnnKG8QKjusSx/GFHSq89tR9Up94+wFt71vyStCyZF3AQ6/kuau7yPpiRMKCgNjgcCwOb/XYd0aKhdM9Fky3cbQPRGhtY9teD3Ax8COGyVEHoFDkfIWN/+dT900/ddhO2/3uZ7ev3jdOyhrFOBSK60mnemj2WkHJxOvY2BshBxtjKEQJgZQqq24oMPEGoriL5lR7+fWONQRhjebuYnr4XRxH181ujc5996L0B95zYPvWL60LebkzYPH6Is/2+NzTF0AYi/pe9UzLssjlcnxr0TTOvmYdfjzo/mEcR5+e2x5e8aHXNH3u/abjLcvWR9ZTq/M8vK7Iv3uKEruhtOlBiYfN1JTNa9s89pmZZtvpLvOnW0Shj1YBlu1gWfo5Y7gY2bwxbKWGcYzrerTE+fO/eETHo2/asf3Xv350/ZQwMihHmTgGq5KH/+qfNvNT4dSUVsFmnnbrQWxAK8K0RluDg8GPNyaGeAvF67D0jZccM2/B3I74CbEdGRQyQUdROOWEbVu5Z1lngFaHXXHcnO3ntPOobVtEYUgUh9gW2LYLEmXsX8DvkR0+Y4KuIRVoregK4nGb4Wzbxrbty4wxV7YQvnnh9OjknWZ5h1tWZiYoIqNRypRIqL36etf1iKICp243lT8tXjcozorWGu26y4BPxnF0wdYd0Vnzp9pveMNuU/aPjMIPoBAYURoUpBxFygFLG8IwFOnWVti2B+Je9A/E5e2let4vGc84jo1S+skZyj/8myfN/nIUqU8TQ1w0O207JXPBO3abkTtke+ciV7QBoBT0yx7TXlfbtpnZoqClSRZYRxtzOAwvPO+gec8fvqNzbWLHlPtqg1J6ODe8uqG1tUG71jeBn0VRdMbWHdFR86boIw/dqSWllCYyijg2uLYCnIqgDiL1pthhloHp7TxZYwuu1hauaz0MnGaF4YELpoanL5yZPvZkq3nb82NFMVQU/JjQgK1kI6HnKCxlCIOA2EQoFJ7nRUjckRuM4XfU6QmkEg/dZPHt6l22Cp796bxZ3zFwgq3tOYDKuTHRvhmsB3NkP7/DZ1cfN89orY6HzZUyqH6oJMuG1tqxJM39hGJCiHfh1ObwUwfMDOe0Fl5Oe+n/QNg+8KuF1taDB+9gw92O+d1x83MzmgrLbTt9F5CyHWeZI6mtH0L8VDdKutVKobQmCHziKinS9wN2aLH5V3EIrwStZYvmKIUipVTkOM5VjuNcZYyZYYzZCeJFlop3BrYBaxpDRPO3bYvT923nurU58sNIClpbS1Ip60vGmC8ZY/bWxAd4Nge4ltnRGNOhlMoopRylCI1RWdu2Ox3HeRaJtPYg4mc8ZiRmn544jj5jKfV723W/rFRgXXLatr5F9LQx5hGlBhZijNEopVYMc8sh4Xke0yjyt1O2Jl8waMn+Ude1SbP6M1riF4BHtCpfHNKAenEsZRoGXZZlXWBZ1gXGmG2NMTsbE++jYSetmWOMbqtVD1prgqDIRQfO5Nx71wwrC9i2fY9t2/cYY1qNMXtoFb8mZbPIs8x8Y0ybUiqllLIV+MaorO04a5RSjyH+xY8gbodjhEFrC8/znorj6E1a6VNBvcNxbK+3kC32nLMHHWffQ8+h21AsFj6XTqe/jCT2nNQoC3dpM0Ic7/HAhBDvjCaXma0Wtm33am0dVv27MYacL6L9tBaN6zidWuvXjWcZRMDVhGFAPlsgn89jTEx5DO8ojjlmocXWrfOJYlOxGzOKQtbkFBc+ti6JeTo2XVkptUYptYbqgOpDwLIsprZoFnpWXQ4MiavTw8j233L7bBPiRhYCPaMueJ3Q2gJ4KDbmzY5j61A2pPzHtq29x0OR0EqBMRQLBXo3bMB1Xaa0ivUqjuO6LQWW5T6ptRqXMtULpdSLSqkXqXM3pVIwu92mvsQloJTqUUrdSWXYUgW0IGO7wCh820eLpO3/BPzJGHQmk6F7F00H4G4oYs200FpPemm3CpukvBNCvMXIUAgM7SP1ICOqcfM4O6IoJZ0im82SzfYmWz81qsptzLZt4jhifvPgwFJRFLOg2dC0z3S++8ArSYaHTbFgbygGhkJsNtb82Ed16vgJhjHEVrJdeKwEp8tfOvl/d3cXuVyeTCZDFEX09fUxZcoUSSyZ2LTjOh64MaSrlWSunmjiLgTxxo58wwROtMMgBoMqaZVb7v6ZTYJJEY93PKGUSI09PT309PRiWRpriNgBkrJa09zcUuM+iigK2V1388UDZ/HNu1YmRFC2g2cCBqEMbM3iQrTZ/bLUJt59ppUijAa0UqU0vb29kkpJAiBhWRZBENDZ2YljO4RhSCqdpqmpiTiOxp0YjZFJO4wkvohWqi6SH9uzIIw1sR+PU5jlBiYrXlXEW5J0e3t76e3NYpdcbcYAYwyWZdPc3MQeTh/fO3wOndmIWAFa40cQo9DjzL6WZRFGAR+Z30TWN5vNOVIrRRzH+LHd7xI2kbCsAQ2lXDMxJu4n3YFzbcIwxE82rPiByIiZTAbxaNMYE48LCdu2TRD4rF+/HsdxmdLRMSHkq8V7gVavyGmz02SLDZHx1YwtjnhlZX1gz3i5VKYU/ZLuxpBuCbLKaZFOp5kX9zAnExPHsUjRaY/IWOOQ1HcAWim0penq6uL1W/dRtNJEsYWto/73nihpKzGlArLAl8/l2bChEyfMiCtKTw8Pt2dQ2mK83acty6Kvr4+enh4srStsAtXmIRjQVPoVGWPI9vZSKBQwJiaVStOUyWDZmiiqXwou1XEpjoJWiqJfpLNzA8YYisUiG7q66OjoSOLYxLL5hbGbIUptHgQhhUKeINfNabtqjJVDW62UPKA35hnDoV95q7pvHBvWF2PI9kFsWFc0yYTTmBDGA1sM8ZZMCFEUEUYRYMjlyhbMlMKYmEKhMC6kW41MeR44Y/CDLoK8Id3aWiFdlaTuKIpq36gKJa8Lua1hw4YNFItFbNtBxxsIfIWd8oiSlTbbssZ9AJaqyk5mkVwuR1dXF7Zt0xr38dvjZ9PdE9DS7OLnu0m1NA0p9Y3GFlpui+8n3bG0WzJr+Mkmm56eHgqFPOl0hnQ6ldiCaxNwyZSAUtK3Ap98odDfLoVCIQljKnWTz+cB6Ghvx3UcgsT9UWsLrRRRHNdtohHTSkShL0sulyeKIhzbJopjomI3vT0xba1txMYQxSGWZY2rtD0Qd0nIvxxNTU0ctzDP3u0LULbFtBZFEATYtpVEcINBGba1hbXZDWRbBjYP8ZpkYBZ9TCJh6CE6q0ncV4IgoFAo4vtFioUiSmuiKOz3Fy99lgbIhEJcqchmsyilaGlpES/HJNNwPl8gkxaX1bhCekskuOSY0hrf9/F9CcHoF31yuXy/TdrSmmxvN/mcLWnE45im5maam5sx1dkQylAiPl1uKBxisCqtyWZ78f2ATDpNmCxeibeEJp22Id9LuiVEKU2uzwET0d7ehtai0pekUqUUxaK8i2VZ/Y0ylNpfIt3e3o0g3f4XUWgl9WbbQhK+300hnyeVTpNOp/rro1QerRTatvD9gFwuR7FYxBhDKbGoMdIG5X3Ktm0KhQJd3d1kMpnkugKWZdPe3obruhVSdn+bJ8+NY4NSqn/TRG9PD7GJ0WpgLaJUfyWSj2OZVFzXo729rX8i6dcGqsM2UkmKFf0uaY+SsNLTLRsoXc/td7fUWnyOnaiTWc2+lNfYdHcXsSxNKpXCtmy8VKr/OVpr+vqy6Eieb0Vyn/JxbWS0V5Z1NOrIUOcmv02UNjgR2CzEqy0Lx2h2mdWCTUQQ+ORyuf5GNCYmk2nCcWxs2yGb7aWvL0cYhkljakwcbxqSHQa2bZPL9RH4PiqJZhWGIUEQkM/naGlpJZ1KEUYiEZk4JpfL4fs+juNQLBaJooggCBKio3IhUCmUgTiRng2GbLaXMAywbbm+AsagtO4nxWKx2B9Vq1DIJ98HyNiydFK/WeLYUChIfJtyDxBjDKmqdDPFYoG1awNaWlpIp9P4vo/WiiiM6O7uljxcKLyUh+t62LbVr62UxmGJdLu7u8ddQymZiACCMKDY7ZPP57Asm3Q6jed5WJbC9wMi36enp0ekuTLiGw6WZVEsFsjlcliW1FUQBGzY0EVrayue66K0ShblwsRurWjKNPVrFfm8aBVaqyH7sdZCvqVJsFAosGGDobW1NfH7lXoPw5Bstg/P80inU7JRw3WTuhCSLRYKBGGA54kGgDL09vTSl8uhFPTlKr3OlJINPeUbTjCGKIzo6enFGENbWxutLbIw3dPbS1dXN0EQ0PK9XbAt2Y7e1d1NHMc0Nzf3awjZbBaAlpZmwjAkV5mFpaotxXSUTqfJZrOEQVBxrjExnueRSep2NKalzQllJqCUi754LZ86cBqzWoLSThdgQK2zLIvunm66u2SQaqWJqxzilRLbmeO6+H4xOTY51Zg4HjArlAZJFEVYlkVTU4Z0OkPg+/T19VH0/UQCSXbKqFFKesYQm7j/+ho/k06n0UqRy+fk/pSk4MrzSypxSfoZ7Ttrpfvbp2SDHLBFmv4yuo5LU1MTnucRxTGW1vTl+sTrZGMl3TohUq6UKZ1Koy1NLpdPJEc1Pn3LGMIoorm5mVQqRbFYJPB9ir4s/rmuQ3NzC8bEQrqjbfvkPZTSOI5TUe+ldwNpT9fzaGpqwnVdenp6yGazaJ20h+thTEwQBGMXXozBYMhkxASXy/X1S7NFvyihRVH947rUV4Ig6B8vWuma/bIaJS4Y7lzLsslkMiKN2zYmjkdl9qnGQQcdNKbr6sUmk3hLal0QhPRms/T1ZbFl62nye+0OIHa7yUm4JdTqvCVVu6dHFn3CMEw8JQbOHVOfKFOpa10v6n6hQuqDZNFoHPlNa6vMrqr7n1H9LKXE6yDoDnBsh5KfRhiGm4x0pRy6/1G5fK6mGWEcHiKmiHyeQj5PGEUV7oxBENDVtQGl9JhIt/Qeteq9+lb5fB7f97EsXVHXSkEQ+GLX3Zh3T8iwJL2W92vPS/WbNcrHdWmiGGu/HO7cOI7o7e0hn8+TTqfIZDI4jk0cxZPSBDEhxBvGpt/HdWDLbkA+myWfyxFG0SAXoaEw2Ul3WCS2vDAMK1bLJxKlFf9NwmfJ4BsJJZIOygLOb852nXATVWJzrO7jpXroX5DYiPuPVO+liT8Mw0F1PZ51P6RZpsb7TWSbl/p8FIV0d/ckG24k5vFwi6ubCxNCvH4i15RWbXO9vRSLxX4breM4I6oXryZs0ZPHeKFOkn7VYChi3ZSbUv5/q3NIzDBCtD09veTzBdLpFKlUut8EMRkk4Akh3vP3T5HSPfT1yUqj7/vYpZVu+P+KdBtooIFNi3I/7zgSAu7ry/Wvt0yGRbgJIV4d9xGFNiaJOlOvWaGBBhpoYFyRmPuMienp6e03QaRS6X5zzOaQgCeEEStcUBpooIEGNjOU0ti2qjBBpFJeIgHbm9wGPFlE0RYkS+qOSBjDJUgutSVl52wFbIekTY+BDcDzwMph7nswcFTy/weAa+ssj40kewyR2LXVOBDoBZ6s8ZtOrn2S2iH5pjOQzr4PScu+tMbzFyFxU8uz9h6PxFTtSr63Arsm97SQJc0+JIVLBjgMCQ0ZI8GdPSQAe5Tc47bkPjsk5X6m7FkLkHapjtu7e/KcWnGS9wfegISk7EGC2N9P/aEJ24BdgPuSMlZjbyCoenYbksPscaS9Fib30Eiq8w1AB5BKrn0KeKHqvm8FDkDSo/8NeLTGs7dD2uwRID/Ebw8lz6zGbkh/qQ443wEcgsTyipG2TiHtapC+fV9y7nD1fihwBPLOtyOBzqsxB5jN4Gzc2yXPrNWXa93jdKQPPYHUVVfyWxNS788jdV7C9km5y+t8d6R/lOrjdUiqICu5Xx6pT4206X+Q+iv1j2nIGDFAFriljrLXNEHkcnmamjJkMplR7efYWEyIH+/1118/mtOPBS5BCOMhhDAOQAjp9QwEUf4x8DHgDqTDbos0zFeB79W475+QAVUi26OQTncCI4fNmwWsSv4/n8oBcyhwK0KAtWIIvw34A/AD4NM1fv8y8DXgHqTTdyTHvlN2zgwkDc9ZwG+TY7cAc4HXAuurnvUY0jGbkA7+FqR+/oTEF7UQUuxF6rgDqYtSYsP7kE58QFkZLkZSxL8WyVZRwjNInNe9yo5p4HfIoLwFWJO82wHAO5DsIfXgJ8BHgTOT+1VjJTLQdig7dhRCAHOROnsHcB4y+Gcm5y5OfmtJ3usXybVbAdcD85DJajoycXwf+GzVs/8GHAd8EkmTVIKH9JUORHB4ruq6qQihrkX6VbnD+o5IctGAgcl2PTI5tCB95IPJuc8iE9jeVfe/DKn3a5N7H5tcdyyVGZ/PR8bKW4Gryo7/FdgH6efD4SDgLwixdgKHI+PxkuT31yMT+XvLjoFMAr1InyxhPXA1A/3vIuA1yX33RSae0oRjkvOeQNr2CmRizCL9fTFw6ghlHxIl/+4pU6biSnotedlXix/vEJgOXIdIRkcx0FHagK0RwigRbzPwMtLANjAFeDdCuh7w9bL7fhfpYIcxkIV4AfAiQlTHjVAugwyWaUiq6x+X/fau5HMdtXFW8vlm4HMMltzSSMd7DfKePwK+jdRDKbVRaTYsSU9fRSSarRkgXZB6iICTEO1AMzCwlyAD2SASzQrg78AZSL2Wl6tQ9swSOpPPqxBJqYQ8g1O4/xQZ/MdQKW3thAy6emAhpAdCNrWIN8dgaTNCJu3S8v2VyIQTItmSbwQ+gRBndYSfaxHC2YGB9z0JIYVVVBJs6bmnVB0/ASHd8jKU4x3J53TgSODmst+eRdoIhGhXIsTyMaQty9skz+B3vxCp9/0Y0Mx2Ap5G2u2NZeeWhI1LGCBDkD5Wfd9a+D9gGTL+QMZfeR8q1Wt1tokig7WAXNWxcxnok5ci4/oQBvpZqV7t5P5vQrigvL+PCUppFCbZQagYZif+uGJz+zmdj1TmCVQO5m5khitvHMNAdPgQkaq+j8z4X0NIEkSq+CzwTSpTvy9BJMRjkY46HCxkIL7EANGCEN9+yW+1wrfvj5ghPoNInKfXOMcgEo5B1KpfJcen1zh3CdLRz0/uu7zGOTFCqqX/lz+nmsCjqs/ye1R3uTZErd4Kqeehzp0NfAiRVqtV3GfKyjYSTkMkmPMRSXlRjXNqldMkx8pJqjT4S/2l5EAclZ13YvKMtzBAugDXIOT9A4QMS2hBiGcXKqXOUxDpej21+8SHgQsQVf78Gr+XUEzKVmqb6neqfvc5SL1/l0pz2DPI5Ho8lf18KiKt2ojwMdR9h0KOygm4k7JM2WVlrZ7Aa92/+t1gcN+sHvvl59Xq72OGwdDX10cQDAQimmhsbuI9EJHyukc6Ean8WuW9LPl8bfK5f/J5a41z/5t8Hj7CszQyWC9D7FElEng3QsZ/pzZRfhzp3P+bfH6sxjml97CSe/wEqYNq21sOUdsuQgb3vTXuFSb3+iAyqZyJqNfVKCWZHM3OgTbErPMBxGSyR3K8ug32Sj6vHsW9a+GTiH3yf5BJ+JyNvB+IJgTUzBp7ZPL5QI3f/oFIWQvKjrUkx1czMKHOQUwqFyFSbzWZHIbYnD+NmIwOQgSDWii1Ub1a6L7J599r/FZ6p3J9uR3pZ8cjGl9p7aPePvF+hLyXIZrNRKFUnlqJUcPk93OR/v5uxCy3USjFwVi/fj09PT1J9MOJxeYm3imIulWNZmTg1zP1lGa/tuRzTvK5psa5pVm0nmy3HQiZPI8QGoiU9BdqS7zNSIf+UvL904hktFPVeRuQzrIcGcR5hNjLF6BMcvxMYBvEDlcLAVJH70U648cQSXs8oJCB9ktk4aqUN6yLynaZl3yWm0BK10+hvoG9J7IA9Znk+7eQgZWqOm88RZGZDCxGVqOkfZXFAiWFmKp+xYD54D3Iwug/q84t4UvAnxHJ+4dIm569keUuoTTxd9b4rSTpl5cpRt7538lfSTtZS308cC+iifQhE9Cvhj99QhAgZT0L6e8fZ2TbdF0obcXu7e2lq6trPG45LDY38W5ABlw1foB05noG2nbJZ4nAlyaf82ucWyLneuyOJZvyHxBb2X7J9VcipFyt5pyU/H4q8BvExgyVpgqQxcNehGQeRQZ/9aq/Su71AURKf4nak0UKkQLeiNjE9mZAqt9YGKQOQExBcxEptLruSouQ1ZL2zsii3xsZGacjUumXgV8jmlATAwRXQi2bno/U12hJ+eXkmvYav3Ukn+WaWGmsXIpIrUcidvfLETKqHktTEM1qF4SkfoK04dljKGstlASOWhJ0yUTSVXW8lFb+xOTzAoTMBueTr43HEUHiI8iC12/KfitNsNXios/48UzJM+U4Bvr7fcNeMRoksTaiqNpMPf7Y3MR7M6KKzak6PhNp4HLVTVHbxegTCIE/knwvNcQpNc49rOy5IyFG7Ma/QEjwCmTV1qe2dPNxZFGjmwEb9NMMJo80siJ7OTJwX8/AKns5bGQSORmRKv8xRDkV9S2OjAUlknsJsSVejKiv5QuLdySf76y61kHatZZJpvq8dyBmhpKN82lEEntf1bldDFbF08iAHK2978bk89Aav70JqdOlZccMQnIbEAL6TfLsmxDNoBrvQfrBP5F3coA/IusE47FkXrLr1lrRPzj5vKPqeKmOssik/mGEhKu1lZFwIbJI914GzDldyWe1uWUqtW3fY8VE9nd5wCbY4r+5ifdHSEPdyIDKCoNXn0vH2hDSa0EI+38RMj2TATPCeuALiP3nTWXXL0II7vfU9oUsh0I6VDNiDngFWfm+Mvm9mUq74esQm9upiLr/AcRm+U7EVHBa2bkakTxsZBCfg9jPjq96PkidZBHp8RAG7NklWEinno3US1vyV6uje0McJ3mXajuoU3X+55EU8tOodMfrRFzh3oOof17Z9TByHzsrKf/hCBGUbMpfQAhq97JzL0dszYeU3ftLCEHWIg9d9VmOWxBS/COVttxzECn9XCo1EZcBDeAKpG2eQ/rdlOR4uST7BeBnSD84J7nfaUjdnV+jPCATSL1ttBZZVD6bAXstCOlegPSVct9cp+r6XyLjbltqCzTl8JDxs3VZOXdDxlFJPHwSETY+w4BgshvSrjdSieH64nAkbSXvMIfK/l7Lhj+psbndyV5B7EaXIRLrA0iZ9mNAAiphNTJ73sqAO1kPg12YQNyzZiD2tZIP6kGI2eCMOspVUv9LDXouov7elXyvdqk6G5GCqgn9YWRwfpyBleQguXdpkP4CIez/Q957CQMr9SUV8BmEmP+G+C1+LTmeRQbNlck9veTa9zNYBat24SlHLXeyIoMHwbsQ80i17fW85NjPEOJchkw4vdS24ZfjbIT8qgf/HxAp+0MMLLRdgCyi/hPRPloR0j6lxvUkx6IhfgNx+fsTYr98EDE7LELI8tKqc8vb/LdI3ZRs7z6VHhPHIST90xrP/CEyWcxm8OafPoZuo1puWV9FCKjkkhkjboq/Z7CJq8hgN8D3Iuag6vasRoiYSnZCxuhWSP89mUpvhBOAG5JzXkDG3HVI3y5HDobMYu8ztPZS6u9/oLK/v4/ai6STFpNhAwUIoZ6ENGyMrPDfhszqJcxBpM7pSKO/gpB11zD3PZKB1esHESKuBy6y4LN4iPvviHTW0g6nA5Kyvljj3J0Q+2hpd802yDs8yMBA7UAI5T5EanAQon+WykXCAxCy+WfyvR2RAEs710A65q1ULrqUdtN1MnjXFgzs9CqfOLZHJrhnqs59LTIAau3uOhiRcFoQc8RNSBsN18mOQEwLtXYg7o60RfXuwTOT37qQSafWO8HAzr6nGb6fnI4Q7gZkcqv2MCmVJTfEszqQdn40OWd7RDCoZX9sQgjpgaoyWchGhnVU7tgsYW9kbNSq96OReleIwHJDjXO2Scr5SNXx3ZNnVx+vxh6IWWwnZGK9hNoL2NsjgsRWSD1ezmAi3RsxydUaLzsi/fnuGte1U7u//5vK3XIbjRNOOGE8bzcIE0K8DTTQQAMNDI3NbeNtoIEGGvj/Dg3ibaCBBhrYxGgQbwMNNNDAJkaDeBtooIEGNjEaxNtAAw00sInRIN4GGmiggU2MBvE20EADDWxiNIi3gQYaaGATo0G8DTTQQAObGA3ibaCBBhrYxGgQbwMNNNDAJsb/A2NEwwYsnNYXAAAAAElFTkSuQmCC"
                                                    alt="Istanta 2 GDO Suite"
                                                    width="600"
                                                    style={{
                                                        display: 'block',
                                                        width: '100%',
                                                        maxWidth: '600px',
                                                        height: 'auto',
                                                        borderTopLeftRadius: '8px',
                                                        borderTopRightRadius: '8px'
                                                    }}
                                                />
                                            </td>
                                        </tr>

                                        {/* Header */}
                                        <tr>
                                            <td style={{
                                                padding: '32px 40px',
                                                borderBottom: '1px solid #e4e4e7',
                                                textAlign: 'center'
                                            }}>
                                                <h1 style={{
                                                    margin: 0,
                                                    fontSize: '24px',
                                                    fontWeight: 600,
                                                    color: '#18181b'
                                                }}>
                                                    Istanta 2 GDO Suite
                                                </h1>
                                            </td>
                                        </tr>

                                        {/* Content */}
                                        <tr>
                                            <td style={{ padding: '40px' }}>
                                                <h2 style={{
                                                    margin: '0 0 16px 0',
                                                    fontSize: '20px',
                                                    fontWeight: 600,
                                                    color: '#18181b'
                                                }}>
                                                    Recupero Password
                                                </h2>

                                                <p style={{
                                                    margin: '0 0 16px 0',
                                                    fontSize: '16px',
                                                    color: '#52525b'
                                                }}>
                                                    Ciao <strong>{userName}</strong>,
                                                </p>

                                                <p style={{
                                                    margin: '0 0 24px 0',
                                                    fontSize: '16px',
                                                    color: '#52525b'
                                                }}>
                                                    Abbiamo ricevuto una richiesta per reimpostare la password del tuo account.
                                                    Clicca il pulsante qui sotto per procedere:
                                                </p>

                                                {/* Button */}
                                                <table width="100%" cellPadding={0} cellSpacing={0}>
                                                    <tbody>
                                                        <tr>
                                                            <td align="center" style={{ padding: '8px 0 24px 0' }}>
                                                                <a
                                                                    href={resetLink}
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        padding: '14px 32px',
                                                                        backgroundColor: '#2563eb',
                                                                        color: '#ffffff',
                                                                        textDecoration: 'none',
                                                                        borderRadius: '6px',
                                                                        fontSize: '16px',
                                                                        fontWeight: 600
                                                                    }}
                                                                >
                                                                    Reimposta Password
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <p style={{
                                                    margin: '0 0 16px 0',
                                                    fontSize: '14px',
                                                    color: '#71717a'
                                                }}>
                                                    Se non riesci a cliccare il pulsante, copia e incolla questo link nel tuo browser:
                                                </p>

                                                <p style={{
                                                    margin: '0 0 24px 0',
                                                    fontSize: '14px',
                                                    color: '#2563eb',
                                                    wordBreak: 'break-all'
                                                }}>
                                                    {resetLink}
                                                </p>

                                                {/* Warning box */}
                                                <div style={{
                                                    padding: '16px',
                                                    backgroundColor: '#fef3c7',
                                                    borderRadius: '6px',
                                                    borderLeft: '4px solid #f59e0b'
                                                }}>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '14px',
                                                        color: '#92400e'
                                                    }}>
                                                        <strong>Importante:</strong> Questo link scadrà tra {expiresIn}.
                                                        Se non hai richiesto tu il reset della password, ignora questa email.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Footer */}
                                        <tr>
                                            <td style={{
                                                padding: '24px 40px',
                                                borderTop: '1px solid #e4e4e7',
                                                textAlign: 'center'
                                            }}>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: '12px',
                                                    color: '#a1a1aa'
                                                }}>
                                                    Questa email è stata inviata automaticamente da Istanta 2 GDO Suite.
                                                    <br />
                                                    Per favore non rispondere a questa email.
                                                </p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    );
};

export default RecuperoPasswordEmail;
