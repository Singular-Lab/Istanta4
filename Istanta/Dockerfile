# Build from the suite root: docker build -f Istanta/Dockerfile -t istanta:local .
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS build
WORKDIR /src

# AgenziaLib references Istanta, which references IstantaLib.
COPY Istanta/Istanta.csproj Istanta/
COPY IstantaLib/IstantaLib/IstantaLib.csproj IstantaLib/IstantaLib/
COPY AgenziaLib/AgenziaLib.csproj AgenziaLib/
RUN dotnet restore AgenziaLib/AgenziaLib.csproj

COPY Istanta/ Istanta/
COPY IstantaLib/IstantaLib/ IstantaLib/IstantaLib/
COPY AgenziaLib/ AgenziaLib/
RUN dotnet publish Istanta/Istanta.csproj -c Release --no-restore -o /out/app /p:UseAppHost=false \
    && dotnet build AgenziaLib/AgenziaLib.csproj -c Release --no-restore \
    && mkdir -p /out/app/external_lib \
    && cp AgenziaLib/bin/Release/net10.0/AgenziaLib.dll /out/app/external_lib/

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS final
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    external_paths__pathLib=/app/external_lib/
COPY --from=build --chown=app:app /out/app/ ./
RUN mkdir -p /app/logs && chown app:app /app/logs
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Istanta.dll"]
