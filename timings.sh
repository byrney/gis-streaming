function perf {
   curl -o /dev/null -s -w "%{time_connect} + %{time_starttransfer} = %{time_total}\n" "$1"
}

echo "pg-promise no streaming"
perf 'http://localhost:3000/sync'
echo "pg-promise strip out geom column"
perf 'http://localhost:3000/streamstrip'
echo "pg-promise raw geom column (wkb hex)"
perf 'http://localhost:3000/streamraw'
echo "pg-promise geo json"
perf 'http://localhost:3000/streamjson'
echo "pg-node no streaming"
perf 'http://localhost:3000/pgsync'
echo "pg-node streaming raw"
perf 'http://localhost:3000/pgstream'
echo "pg-node streaming stripped"
perf 'http://localhost:3000/pgstreamstrip'
