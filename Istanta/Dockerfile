# Build from the suite root: docker build -f Istanta/Dockerfile -t istanta:local .
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS istanta-source
WORKDIR /src

COPY Istanta/Istanta.csproj Istanta/
COPY IstantaLib/IstantaLib/IstantaLib.csproj IstantaLib/IstantaLib/
RUN dotnet restore Istanta/Istanta.csproj

COPY Istanta/ Istanta/
COPY IstantaLib/IstantaLib/ IstantaLib/IstantaLib/

FROM istanta-source AS build
RUN dotnet publish Istanta/Istanta.csproj -c Release --no-restore -o /out/app /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS agenzialib-source
WORKDIR /src
COPY AgenziaLib/AgenziaLib.csproj AgenziaLib/
COPY IstantaLib/IstantaLib/IstantaLib.csproj IstantaLib/IstantaLib/
RUN dotnet restore AgenziaLib/AgenziaLib.csproj
COPY AgenziaLib/ AgenziaLib/
COPY IstantaLib/IstantaLib/ IstantaLib/IstantaLib/

FROM agenzialib-source AS agenzialib-build
RUN dotnet build AgenziaLib/AgenziaLib.csproj -c Release --no-restore

FROM scratch AS agenzialib-export
COPY --from=agenzialib-build /src/AgenziaLib/bin/Release/net10.0/AgenziaLib.dll /AgenziaLib.dll

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    external_paths__pathLib=/app/external_lib/
COPY --from=build --chown=app:app /out/app/ ./
# AgenziaLib is installed independently by Company.AI.Runner in the mounted volume.
RUN mkdir -p /app/logs /app/external_lib && chown app:app /app/logs /app/external_lib
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Istanta.dll"]
